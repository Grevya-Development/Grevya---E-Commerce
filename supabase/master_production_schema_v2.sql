-- ====================================================================
-- GREVYA NATURALS - UNIFIED MASTER PRODUCTION SCHEMA V2 (CLERK FIRST)
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- EXTENSIONS
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- --------------------------------------------------------------------
-- CLEANUP OBSOLETE OBJECTS
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_profile_role_escalation() CASCADE;
DROP FUNCTION IF EXISTS public.auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS public.has_permission(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;

-- Type mismatch detector for products/variants (UUID vs BIGINT)
DO $$
DECLARE
    prod_id_type TEXT;
    var_prod_id_type TEXT;
BEGIN
    SELECT data_type INTO prod_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'id';
    
    SELECT data_type INTO var_prod_id_type 
    FROM information_schema.columns 
    WHERE table_name = 'product_variants' AND column_name = 'product_id';
    
    IF (prod_id_type IS NOT NULL AND var_prod_id_type IS NOT NULL AND prod_id_type <> var_prod_id_type) OR (prod_id_type = 'uuid') THEN
        DROP TABLE IF EXISTS public.product_moderation_logs CASCADE;
        DROP TABLE IF EXISTS public.product_tag_mappings CASCADE;
        DROP TABLE IF EXISTS public.product_attributes CASCADE;
        DROP TABLE IF EXISTS public.product_images CASCADE;
        DROP TABLE IF EXISTS public.product_seo CASCADE;
        DROP TABLE IF EXISTS public.inventory_movements CASCADE;
        DROP TABLE IF EXISTS public.inventory CASCADE;
        DROP TABLE IF EXISTS public.carts CASCADE;
        DROP TABLE IF EXISTS public.wishlists CASCADE;
        DROP TABLE IF EXISTS public.order_items CASCADE;
        DROP TABLE IF EXISTS public.product_variants CASCADE;
        DROP TABLE IF EXISTS public.products CASCADE;
    END IF;
END
$$;

-- --------------------------------------------------------------------
-- RBAC SUBSYSTEM
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

INSERT INTO public.roles (name, description) VALUES
    ('customer', 'End customer browsing catalog and placing orders'),
    ('seller', 'Store manager handling inventory, store profiles, and listings'),
    ('admin', 'Platform moderator regulating products, reviews, and stores'),
    ('super_admin', 'Full system control and platform settings management')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.permissions (name, description) VALUES
    ('product:write', 'Create and modify own products'),
    ('product:moderation', 'Moderate, approve or reject catalog listings'),
    ('order:read_all', 'Read all orders on the platform'),
    ('order:write_status', 'Modify the status of assigned order packages'),
    ('user:manage', 'Manage, activate or block profile roles'),
    ('system:settings', 'Modify system-wide parameters'),
    ('audit:read', 'Access platform audit logs')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin' AND p.name IN ('product:moderation', 'order:read_all', 'order:write_status', 'user:manage', 'audit:read')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'seller' AND p.name IN ('product:write', 'order:write_status')
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------
-- CLERK INTEGRATION HELPERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    coalesce(current_setting('request.jwt.claims', true), '{}')::json ->> 'sub',
    ''
  );
$$;

-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE,
    email TEXT UNIQUE,
    phone TEXT,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB NOT NULL DEFAULT '{"marketing":true,"order_updates":true}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist for existing databases
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{"marketing":true,"order_updates":true}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Ensure clerk_user_id has a unique constraint if it doesn't already
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='profiles' AND constraint_type='UNIQUE' AND constraint_name='profiles_clerk_user_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_clerk_user_id_key UNIQUE (clerk_user_id);
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'profiles' AND column_name = 'id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof_id UUID;
BEGIN
  SELECT id INTO prof_id FROM public.profiles WHERE clerk_user_id = public.clerk_user_id();
  RETURN prof_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- --------------------------------------------------------------------
-- USER ROLES MAPPING
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE OR REPLACE FUNCTION public.has_permission(user_uuid UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role_id = ur.role_id
        JOIN public.permissions perm ON rp.permission_id = perm.id
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = user_uuid AND perm.name = perm_name AND COALESCE(p.is_active, true) = true
    );
$$;

CREATE OR REPLACE FUNCTION public.has_role(user_uuid UUID, role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE user_id = user_uuid AND r.name = role_name
    );
$$;

-- --------------------------------------------------------------------
-- SELLER ONBOARDING
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    tax_id TEXT UNIQUE NOT NULL,
    bank_details JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.seller_applications(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    tax_id TEXT UNIQUE NOT NULL,
    bank_details JSONB NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'vacation')),
    support_email TEXT,
    support_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_followers (
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (store_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'Home',
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'India',
    landmark TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_default_user ON public.addresses (user_id) WHERE (is_default = true);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'addresses' AND column_name = 'user_id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey;
        ALTER TABLE public.addresses ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- --------------------------------------------------------------------
-- CATALOG SUBSYSTEM
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    parent_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    category_id BIGINT REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    brand TEXT,
    short_description TEXT,
    description TEXT,
    ingredients TEXT,
    nutritional_info TEXT,
    manufacturer TEXT,
    country_of_origin TEXT DEFAULT 'India',
    storage_instructions TEXT,
    gst_percentage NUMERIC(5,2) DEFAULT 18.00,
    hsn_code TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    published_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure products attributes exist for migration of existing tables
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ingredients TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS nutritional_info TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS country_of_origin TEXT DEFAULT 'India';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS storage_instructions TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5,2) DEFAULT 18.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(ingredients, ''))
) STORED;

CREATE INDEX IF NOT EXISTS idx_products_search_vector ON public.products USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sku TEXT UNIQUE NOT NULL,
    barcode TEXT UNIQUE,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(12,2) CHECK (compare_at_price >= 0),
    weight_grams INTEGER,
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_seo (
    product_id BIGINT PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    meta_title TEXT,
    meta_description TEXT,
    keywords TEXT[]
);

CREATE TABLE IF NOT EXISTS public.product_tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_tag_mappings (
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES public.product_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.product_attributes (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_moderation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    moderator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'suspend')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- INVENTORY SUBSYSTEM
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 10,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_reserved_bounds CHECK (quantity_on_hand >= quantity_reserved),
    UNIQUE (variant_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('stock_in', 'sale', 'return', 'damaged', 'write_off')),
    quantity INTEGER NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('order_item', 'purchase_order', 'manual_adjustment')),
    reference_id UUID,
    reason TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- ORDERING & CART SYSTEM
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, variant_id)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'carts' AND column_name = 'user_id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_user_id_fkey;
        ALTER TABLE public.carts ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, variant_id)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'wishlists' AND column_name = 'user_id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
        ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_shipping')),
    discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    minimum_order_value NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (minimum_order_value >= 0),
    maximum_discount_amount NUMERIC(12,2) CHECK (maximum_discount_amount >= 0),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    usage_limit INTEGER CHECK (usage_limit >= 0),
    user_usage_limit INTEGER NOT NULL DEFAULT 1 CHECK (user_usage_limit > 0),
    usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_coupon_dates CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    shipping NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (shipping >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')),
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed')),
    estimated_delivery TIMESTAMPTZ,
    invoice_url TEXT,
    cancel_reason TEXT,
    customer_notes TEXT,
    seller_notes TEXT,
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'orders' AND column_name = 'user_id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
        ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    tax NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    discount_applied NUMERIC(12,2) NOT NULL CHECK (discount_applied >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'coupon_redemptions' AND column_name = 'user_id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.coupon_redemptions DROP CONSTRAINT IF EXISTS coupon_redemptions_user_id_fkey;
        ALTER TABLE public.coupon_redemptions ADD CONSTRAINT coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- --------------------------------------------------------------------
-- PAYMENT SUBSYSTEM
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('razorpay', 'cod', 'stripe', 'wallet')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    razorpay_order_id TEXT,
    payment_id TEXT,
    signature TEXT,
    gateway_response JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')),
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    refund_reference TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    payout_method TEXT NOT NULL DEFAULT 'bank_transfer',
    transaction_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- LOGISTICS SUBSYSTEM
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    support_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    pincodes TEXT[] NOT NULL,
    base_rate NUMERIC(12,2) NOT NULL CHECK (base_rate >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
    carrier TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    tracking_url TEXT,
    status TEXT NOT NULL DEFAULT 'label_created' CHECK (status IN ('label_created', 'in_transit', 'out_for_delivery', 'delivered', 'failed')),
    shipping_label_url TEXT,
    estimated_delivery_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- CUSTOMER ENGAGEMENT & MARKETING
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist for legacy databases
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_verified_purchase BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.review_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recently_viewed_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.product_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'product_interactions' AND column_name = 'user_id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.product_interactions DROP CONSTRAINT IF EXISTS product_interactions_user_id_fkey;
        ALTER TABLE public.product_interactions ADD CONSTRAINT product_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- --------------------------------------------------------------------
-- ADMIN & PLATFORM TABLES
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Notification',
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms', 'push')),
    action_url TEXT,
    metadata JSONB,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'notifications' AND column_name = 'user_id' AND constraint_name LIKE '%auth_users%'
    ) THEN
        ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
        ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('announcement', 'maintenance', 'promotion')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_role TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    order_reference TEXT,
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- INDEXES & FK OPTIMIZATIONS
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_stores_seller ON public.stores(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_attrs ON public.product_variants USING GIN (attributes);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON public.inventory(variant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON public.inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON public.order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON public.deliveries(tracking_number);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON public.seller_applications(status);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON public.search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_product_interactions_user ON public.product_interactions(user_id);

-- --------------------------------------------------------------------
-- SYSTEM TRIGGERS & FUNCTIONS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Idempotent Trigger Helper
CREATE OR REPLACE PROCEDURE public.create_updated_at_trigger(tbl TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tbl, tbl);
END;
$$;

CALL public.create_updated_at_trigger('profiles');
CALL public.create_updated_at_trigger('seller_applications');
CALL public.create_updated_at_trigger('seller_profiles');
CALL public.create_updated_at_trigger('stores');
CALL public.create_updated_at_trigger('products');
CALL public.create_updated_at_trigger('product_variants');
CALL public.create_updated_at_trigger('orders');
CALL public.create_updated_at_trigger('addresses');
CALL public.create_updated_at_trigger('payments');
CALL public.create_updated_at_trigger('refunds');
CALL public.create_updated_at_trigger('deliveries');
CALL public.create_updated_at_trigger('reviews');
CALL public.create_updated_at_trigger('carts');
CALL public.create_updated_at_trigger('wishlists');
CALL public.create_updated_at_trigger('notifications');
CALL public.create_updated_at_trigger('inventory');

-- Inventory Version Increments
CREATE OR REPLACE FUNCTION public.increment_inventory_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_version_increment ON public.inventory;
CREATE TRIGGER trg_inventory_version_increment
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_inventory_version();

-- Coupon Validation Check
CREATE OR REPLACE FUNCTION public.validate_coupon_redemption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_coupon RECORD;
BEGIN
  SELECT * INTO target_coupon FROM public.coupons WHERE id = NEW.coupon_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon code does not exist.';
  END IF;

  IF NOT target_coupon.is_active THEN
    RAISE EXCEPTION 'Coupon code is no longer active.';
  END IF;

  IF now() < target_coupon.starts_at OR now() > target_coupon.ends_at THEN
    RAISE EXCEPTION 'Coupon code has expired or is not yet valid.';
  END IF;

  IF target_coupon.usage_limit IS NOT NULL AND target_coupon.usage_count >= target_coupon.usage_limit THEN
    RAISE EXCEPTION 'Coupon redemption limit reached.';
  END IF;

  UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_coupon_redemption_validation ON public.coupon_redemptions;
CREATE TRIGGER trg_coupon_redemption_validation
  BEFORE INSERT ON public.coupon_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_coupon_redemption();

-- Store Slug Generator
CREATE OR REPLACE FUNCTION public.generate_store_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug = lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_store_slug ON public.stores;
CREATE TRIGGER trg_generate_store_slug
  BEFORE INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_store_slug();

-- Product Slug Generator
CREATE OR REPLACE FUNCTION public.generate_product_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug = lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_product_slug ON public.products;
CREATE TRIGGER trg_generate_product_slug
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_product_slug();

-- Automatic Seller Approval Handler
CREATE OR REPLACE FUNCTION public.handle_seller_application_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seller_role_id INTEGER;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    SELECT id INTO seller_role_id FROM public.roles WHERE name = 'seller';

    INSERT INTO public.seller_profiles (id, application_id, company_name, business_type, registration_number, tax_id, bank_details, is_verified, verified_at)
    VALUES (NEW.user_id, NEW.id, NEW.company_name, NEW.business_type, NEW.registration_number, NEW.tax_id, NEW.bank_details, true, now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.user_id, seller_role_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.stores (seller_id, name, status)
    VALUES (
      NEW.user_id,
      NEW.company_name,
      'active'
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, title, message, priority, channel)
    VALUES (
      NEW.user_id,
      'Merchant Dashboard Activated',
      'Your seller account and store profile have been successfully validated.',
      'high',
      'in_app'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seller_application_approval ON public.seller_applications;
CREATE TRIGGER trg_seller_application_approval
  AFTER UPDATE ON public.seller_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_seller_application_approval();

-- --------------------------------------------------------------------
-- STORAGE BUCKETS
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
    ('avatars', 'avatars', true),
    ('store-assets', 'store-assets', true),
    ('product-images', 'product-images', true),
    ('review-images', 'review-images', true),
    ('seller-documents', 'seller-documents', false),
    ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recently_viewed_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow users to select own profile" ON public.profiles;
CREATE POLICY "Allow users to select own profile" ON public.profiles
    FOR SELECT USING (public.current_profile_id() = id OR public.has_permission(public.current_profile_id(), 'user:manage'));

DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
CREATE POLICY "Allow users to update own profile" ON public.profiles
    FOR UPDATE USING (public.current_profile_id() = id OR public.has_permission(public.current_profile_id(), 'user:manage'));

DROP POLICY IF EXISTS "Allow Clerk to insert profiles" ON public.profiles;
CREATE POLICY "Allow Clerk to insert profiles" ON public.profiles
    FOR INSERT WITH CHECK (clerk_user_id = public.clerk_user_id());

-- Store Policies
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;
CREATE POLICY "Public can view active stores" ON public.stores
    FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Merchants manage own stores" ON public.stores;
CREATE POLICY "Merchants manage own stores" ON public.stores
    FOR ALL USING (seller_id = public.current_profile_id() OR public.has_permission(public.current_profile_id(), 'product:moderation'));

-- Product Catalog Policies
DROP POLICY IF EXISTS "Public read on active listings" ON public.products;
CREATE POLICY "Public read on active listings" ON public.products
    FOR SELECT USING (status = 'approved' OR EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = public.current_profile_id()
    ) OR public.has_permission(public.current_profile_id(), 'product:moderation'));

DROP POLICY IF EXISTS "Merchants write products" ON public.products;
CREATE POLICY "Merchants write products" ON public.products
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = public.current_profile_id()
    ) OR public.has_permission(public.current_profile_id(), 'product:moderation'));

DROP POLICY IF EXISTS "Public read on active variant details" ON public.product_variants;
CREATE POLICY "Public read on active variant details" ON public.product_variants
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND (p.status = 'approved' OR EXISTS (
            SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.seller_id = public.current_profile_id()
        ))
    ) OR public.has_permission(public.current_profile_id(), 'product:moderation'));

DROP POLICY IF EXISTS "Merchants manage variants" ON public.product_variants;
CREATE POLICY "Merchants manage variants" ON public.product_variants
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON s.id = p.store_id
        WHERE p.id = product_variants.product_id AND s.seller_id = public.current_profile_id()
    ) OR public.has_permission(public.current_profile_id(), 'product:moderation'));

-- Inventory Policies
DROP POLICY IF EXISTS "Inventory select protection" ON public.inventory;
CREATE POLICY "Inventory select protection" ON public.inventory
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.stores s ON s.id = p.store_id
        WHERE pv.id = inventory.variant_id AND s.seller_id = public.current_profile_id()
    ) OR public.has_permission(public.current_profile_id(), 'product:moderation'));

-- Transaction & Order Policies
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders
    FOR SELECT USING (public.current_profile_id() = user_id OR public.has_permission(public.current_profile_id(), 'order:read_all') OR EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.product_variants pv ON pv.id = oi.variant_id
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.stores s ON s.id = p.store_id
        WHERE oi.order_id = orders.id AND s.seller_id = public.current_profile_id()
    ));

DROP POLICY IF EXISTS "Users checkout placement" ON public.orders;
CREATE POLICY "Users checkout placement" ON public.orders
    FOR INSERT WITH CHECK (public.current_profile_id() = user_id);

DROP POLICY IF EXISTS "Users view own items" ON public.order_items;
CREATE POLICY "Users view own items" ON public.order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = public.current_profile_id() OR public.has_permission(public.current_profile_id(), 'order:read_all'))
    ) OR EXISTS (
        SELECT 1 FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.stores s ON s.id = p.store_id
        WHERE pv.id = order_items.variant_id AND s.seller_id = public.current_profile_id()
    ));

DROP POLICY IF EXISTS "Order updates permission policy" ON public.orders;
CREATE POLICY "Order updates permission policy" ON public.orders
    FOR UPDATE USING (
        (public.current_profile_id() = user_id AND status = 'pending') OR 
        public.has_permission(public.current_profile_id(), 'order:write_status') OR 
        public.has_permission(public.current_profile_id(), 'order:read_all')
    );

-- Payments RLS
DROP POLICY IF EXISTS "Allow user to view own payment details" ON public.payments;
CREATE POLICY "Allow user to view own payment details" ON public.payments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND o.user_id = public.current_profile_id()) OR
        public.has_permission(public.current_profile_id(), 'order:read_all')
    );

-- Refunds RLS
DROP POLICY IF EXISTS "Allow view own refund details" ON public.refunds;
CREATE POLICY "Allow view own refund details" ON public.refunds
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.payments p JOIN public.orders o ON o.id = p.order_id WHERE p.id = refunds.payment_id AND o.user_id = public.current_profile_id()) OR
        public.has_permission(public.current_profile_id(), 'order:read_all')
    );

-- Carts RLS
DROP POLICY IF EXISTS "Manage own carts" ON public.carts;
CREATE POLICY "Manage own carts" ON public.carts
    FOR ALL USING (user_id = public.current_profile_id());

-- Wishlists RLS
DROP POLICY IF EXISTS "Manage own wishlists" ON public.wishlists;
CREATE POLICY "Manage own wishlists" ON public.wishlists
    FOR ALL USING (user_id = public.current_profile_id());

-- Notifications RLS
DROP POLICY IF EXISTS "Manage own notifications" ON public.notifications;
CREATE POLICY "Manage own notifications" ON public.notifications
    FOR ALL USING (user_id = public.current_profile_id());

-- Reviews RLS
DROP POLICY IF EXISTS "Public read reviews" ON public.reviews;
CREATE POLICY "Public read reviews" ON public.reviews
    FOR SELECT USING (is_approved = true);

DROP POLICY IF EXISTS "Write own reviews" ON public.reviews;
CREATE POLICY "Write own reviews" ON public.reviews
    FOR ALL USING (user_id = public.current_profile_id());

-- Seller Profiles RLS
DROP POLICY IF EXISTS "View own seller profile" ON public.seller_profiles;
CREATE POLICY "View own seller profile" ON public.seller_profiles
    FOR SELECT USING (id = public.current_profile_id() OR public.has_permission(public.current_profile_id(), 'user:manage'));

-- Seller Applications RLS
DROP POLICY IF EXISTS "Manage own application" ON public.seller_applications;
CREATE POLICY "Manage own application" ON public.seller_applications
    FOR ALL USING (user_id = public.current_profile_id() OR public.has_permission(public.current_profile_id(), 'user:manage'));

-- Deliveries RLS
DROP POLICY IF EXISTS "View own deliveries" ON public.deliveries;
CREATE POLICY "View own deliveries" ON public.deliveries
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = deliveries.order_id AND o.user_id = public.current_profile_id()) OR
        public.has_permission(public.current_profile_id(), 'order:read_all')
    );

-- Delivery Events RLS
DROP POLICY IF EXISTS "View delivery events" ON public.delivery_events;
CREATE POLICY "View delivery events" ON public.delivery_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id WHERE d.id = delivery_events.delivery_id AND o.user_id = public.current_profile_id()) OR
        public.has_permission(public.current_profile_id(), 'order:read_all')
    );

-- Inventory Movements RLS
DROP POLICY IF EXISTS "Admin and creator read movements" ON public.inventory_movements;
CREATE POLICY "Admin and creator read movements" ON public.inventory_movements
    FOR SELECT USING (created_by = public.current_profile_id() OR public.has_permission(public.current_profile_id(), 'audit:read'));

-- Audit Logs RLS
DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs
    FOR SELECT USING (public.has_permission(public.current_profile_id(), 'audit:read'));

-- Contact Messages RLS
DROP POLICY IF EXISTS "Admin manage contact messages" ON public.contact_messages;
CREATE POLICY "Admin manage contact messages" ON public.contact_messages
    FOR ALL USING (public.has_permission(public.current_profile_id(), 'user:manage'));

-- Addresses RLS
DROP POLICY IF EXISTS "Manage own addresses" ON public.addresses;
CREATE POLICY "Manage own addresses" ON public.addresses
    FOR ALL USING (user_id = public.current_profile_id());

-- Coupon Redemptions RLS
DROP POLICY IF EXISTS "View own redemptions" ON public.coupon_redemptions;
CREATE POLICY "View own redemptions" ON public.coupon_redemptions
    FOR SELECT USING (user_id = public.current_profile_id() OR public.has_permission(public.current_profile_id(), 'order:read_all'));

-- Recently Viewed Products RLS
DROP POLICY IF EXISTS "Manage own recently viewed" ON public.recently_viewed_products;
CREATE POLICY "Manage own recently viewed" ON public.recently_viewed_products
    FOR ALL USING (user_id = public.current_profile_id());

-- Search History RLS
DROP POLICY IF EXISTS "Manage own search history" ON public.search_history;
CREATE POLICY "Manage own search history" ON public.search_history
    FOR ALL USING (user_id = public.current_profile_id());

-- Product Interactions RLS
DROP POLICY IF EXISTS "Manage own interactions" ON public.product_interactions;
CREATE POLICY "Manage own interactions" ON public.product_interactions
    FOR ALL USING (user_id = public.current_profile_id());

-- Seller Payouts RLS
DROP POLICY IF EXISTS "View own payouts" ON public.seller_payouts;
CREATE POLICY "View own payouts" ON public.seller_payouts
    FOR SELECT USING (seller_id = public.current_profile_id() OR public.has_permission(public.current_profile_id(), 'audit:read'));

-- Storage Objects Policies
DROP POLICY IF EXISTS "Avatar assets are publicly viewable" ON storage.objects;
CREATE POLICY "Avatar assets are publicly viewable" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars manage owner check" ON storage.objects;
CREATE POLICY "Avatars manage owner check" ON storage.objects
    FOR ALL TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Product assets read" ON storage.objects;
CREATE POLICY "Product assets read" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Merchants write product media" ON storage.objects;
CREATE POLICY "Merchants write product media" ON storage.objects
    FOR ALL TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Seller documents are private" ON storage.objects;
CREATE POLICY "Seller documents are private" ON storage.objects
    FOR ALL TO authenticated USING (bucket_id = 'seller-documents');

COMMIT;
