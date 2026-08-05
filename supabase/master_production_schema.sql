-- ====================================================================
-- GREVYA NATURALS - UNIFIED MASTER PRODUCTION SCHEMA INITIALIZATION
-- ====================================================================
-- Run this script in the Supabase SQL Editor.
-- This script designs the entire database in 3NF, setting up user roles,
-- profiles, stores, catalog, inventory, payments, deliveries,
-- storage buckets, indexes, triggers, and RLS policies.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 0. EXTENSIONS & PREREQUISITES
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- --------------------------------------------------------------------
-- 1. ROLE-BASED ACCESS CONTROL (RBAC) SUBSYSTEM
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

-- Seed default roles
INSERT INTO public.roles (name, description) VALUES
    ('customer', 'End customer browsing catalog and placing orders'),
    ('seller', 'Store manager handling inventory, store profiles, and listings'),
    ('admin', 'Platform moderator regulating products, reviews, and stores'),
    ('super_admin', 'Full system control and platform settings management')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Seed default permissions
INSERT INTO public.permissions (name, description) VALUES
    ('product:write', 'Create and modify own products'),
    ('product:moderation', 'Moderate, approve or reject catalog listings'),
    ('order:read_all', 'Read all orders on the platform'),
    ('order:write_status', 'Modify the status of assigned order packages'),
    ('user:manage', 'Manage, activate or block profile roles'),
    ('system:settings', 'Modify system-wide parameters'),
    ('audit:read', 'Access platform audit logs')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Map permissions to roles
-- Super Admin permissions (All)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin' AND p.name IN ('product:moderation', 'order:read_all', 'order:write_status', 'user:manage', 'audit:read')
ON CONFLICT DO NOTHING;

-- Seller permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'seller' AND p.name IN ('product:write', 'order:write_status')
ON CONFLICT DO NOTHING;

-- Helper check function for RLS and operations.
-- Uses the authenticated JWT role metadata rather than querying public.profiles,
-- which avoids recursive policy evaluation inside profiles RLS.
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    WITH active_role AS (
      SELECT COALESCE(
        NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', ''),
        NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', '')
      ) AS role_name
    )
    SELECT CASE
      WHEN (SELECT role_name FROM active_role) IN ('admin', 'super_admin') THEN TRUE
      WHEN perm_name = 'product:write' AND (SELECT role_name FROM active_role) = 'seller' THEN TRUE
      WHEN perm_name = 'product:moderation' AND (SELECT role_name FROM active_role) IN ('admin', 'super_admin') THEN TRUE
      WHEN perm_name = 'order:write_status' AND (SELECT role_name FROM active_role) IN ('seller', 'admin', 'super_admin') THEN TRUE
      WHEN perm_name = 'order:read_all' AND (SELECT role_name FROM active_role) IN ('admin', 'super_admin') THEN TRUE
      WHEN perm_name = 'user:manage' AND (SELECT role_name FROM active_role) IN ('admin', 'super_admin') THEN TRUE
      WHEN perm_name = 'system:settings' AND (SELECT role_name FROM active_role) = 'super_admin' THEN TRUE
      WHEN perm_name = 'audit:read' AND (SELECT role_name FROM active_role) IN ('admin', 'super_admin') THEN TRUE
      ELSE FALSE
    END;
$$;

-- --------------------------------------------------------------------
-- 2. USER & STORE SUB-SCHEMAS
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    role_id INTEGER NOT NULL REFERENCES public.roles(id),
    preferences JSONB NOT NULL DEFAULT '{"marketing":true,"order_updates":true}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    tax_id TEXT UNIQUE NOT NULL,
    bank_details JSONB NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended')),
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

CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- --------------------------------------------------------------------
-- 3. PRODUCT CATALOG SUB-SCHEMAS
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
    brand TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.product_moderation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'suspend')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- 4. INVENTORY & WAREHOUSE SUBSYSTEMS
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
-- 5. SHOPPING CART & WISHLIST TABLES
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, variant_id)
);

CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, variant_id)
);

-- --------------------------------------------------------------------
-- 6. DISCOUNTS & COUPONS TABLES
-- --------------------------------------------------------------------

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

-- --------------------------------------------------------------------
-- 7. TRANSACTION, ORDER & INVOICING SUBSYSTEM
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    shipping NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (shipping >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    discount_applied NUMERIC(12,2) NOT NULL CHECK (discount_applied >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- 8. BILLING & LOGISTICS SCHEMAS
-- --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('razorpay', 'cod', 'stripe', 'wallet')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    gateway_reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')),
    gateway_payload JSONB,
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
    gateway_refund_reference TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
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
-- 9. USER ENGAGEMENT & SYSTEM TABLES
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

CREATE TABLE IF NOT EXISTS public.review_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_name TEXT,
    entity_id TEXT,
    payload JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Partition setup helper for current partition (logs_y2026_m07)
CREATE TABLE IF NOT EXISTS public.activity_logs_y2026_m07 PARTITION OF public.activity_logs
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

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

CREATE TABLE IF NOT EXISTS public.product_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------
-- 10. INDEX OPTIMIZATIONS
-- --------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_stores_seller ON public.stores(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_attrs ON public.product_variants USING GIN (attributes);
CREATE INDEX IF NOT EXISTS idx_inventory_lookup ON public.inventory(variant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;

-- --------------------------------------------------------------------
-- 11. AUTHENTICATION & PROFILE INTEGRATION HOOKS
-- --------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_role_id INTEGER;
  signup_role TEXT;
BEGIN
  -- Default signup mapping to customer
  SELECT id INTO default_role_id FROM public.roles WHERE name = 'customer';
  
  -- Check user metadata for requested registration role
  signup_role := NEW.raw_user_meta_data->>'registration_role';
  IF signup_role IS NOT NULL THEN
    SELECT id INTO default_role_id FROM public.roles WHERE name = signup_role;
  END IF;

  IF default_role_id IS NULL THEN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'customer';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, phone, role_id)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    default_role_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Role protection escalation trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_role_id INTEGER;
  super_admin_role_id INTEGER;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin';
  SELECT id INTO super_admin_role_id FROM public.roles WHERE name = 'super_admin';

  -- Block non-admin role modifications
  IF TG_OP = 'UPDATE' AND NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    IF NOT (
      public.has_permission(auth.uid(), 'user:manage')
    ) THEN
      RAISE EXCEPTION 'Unauthorized role modification blocked.';
    END IF;
  END IF;

  -- Block administrative signups via general insertion routes
  IF TG_OP = 'INSERT' AND NEW.role_id IN (admin_role_id, super_admin_role_id) THEN
    IF NOT (
      auth.uid() IS NULL OR -- Allowed in trigger creation routines from Auth
      public.has_permission(auth.uid(), 'user:manage')
    ) THEN
      RAISE EXCEPTION 'Administrative profile deployment unauthorized.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_profile_role_escalation();

-- --------------------------------------------------------------------
-- 12. STORAGE BUCKET DEFINITIONS
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
-- 13. ROW LEVEL SECURITY (RLS) POLICIES Setup
-- --------------------------------------------------------------------

-- Profile Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to select own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.has_permission(auth.uid(), 'user:manage'));

CREATE POLICY "Allow users to update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.has_permission(auth.uid(), 'user:manage'));

-- Store Policies
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active stores" ON public.stores
    FOR SELECT USING (status = 'active');

CREATE POLICY "Merchants manage own stores" ON public.stores
    FOR ALL USING (seller_id = auth.uid() OR public.has_permission(auth.uid(), 'product:moderation'));

-- Product Catalog Policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read on active listings" ON public.products
    FOR SELECT USING (status = 'approved' OR EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = auth.uid()
    ) OR public.has_permission(auth.uid(), 'product:moderation'));

CREATE POLICY "Merchants write products" ON public.products
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = auth.uid()
    ) OR public.has_permission(auth.uid(), 'product:moderation'));

CREATE POLICY "Public read on active variant details" ON public.product_variants
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND (p.status = 'approved' OR EXISTS (
            SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.seller_id = auth.uid()
        ))
    ) OR public.has_permission(auth.uid(), 'product:moderation'));

CREATE POLICY "Merchants manage variants" ON public.product_variants
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.products p
        JOIN public.stores s ON s.id = p.store_id
        WHERE p.id = product_variants.product_id AND s.seller_id = auth.uid()
    ) OR public.has_permission(auth.uid(), 'product:moderation'));

-- Inventory Policies
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Inventory select protection" ON public.inventory
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.stores s ON s.id = p.store_id
        WHERE pv.id = inventory.variant_id AND s.seller_id = auth.uid()
    ) OR public.has_permission(auth.uid(), 'product:moderation'));

-- Transaction & Order Policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'order:read_all') OR EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.product_variants pv ON pv.id = oi.variant_id
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.stores s ON s.id = p.store_id
        WHERE oi.order_id = orders.id AND s.seller_id = auth.uid()
    ));

CREATE POLICY "Users checkout placement" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own items" ON public.order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR public.has_permission(auth.uid(), 'order:read_all'))
    ) OR EXISTS (
        SELECT 1 FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        JOIN public.stores s ON s.id = p.store_id
        WHERE pv.id = order_items.variant_id AND s.seller_id = auth.uid()
    ));

-- Storage Object Hardened Policies
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Avatar assets are publicly viewable" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'avatars' AND NOT storage.allow_only_operation('object.list'));

CREATE POLICY "Avatars manage owner check" ON storage.objects
    FOR ALL TO authenticated USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Product assets read" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'product-images' AND NOT storage.allow_only_operation('object.list'));

CREATE POLICY "Merchants write product media" ON storage.objects
    FOR ALL TO authenticated USING (bucket_id = 'product-images' AND (
        public.has_permission(auth.uid(), 'product:write')
    ));

CREATE POLICY "Seller documents are private" ON storage.objects
    FOR ALL TO authenticated USING (
        bucket_id = 'seller-documents' 
        AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.has_permission(auth.uid(), 'user:manage'))
    );

COMMIT;
