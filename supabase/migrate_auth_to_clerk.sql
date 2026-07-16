-- ====================================================================
-- GREVYA NATURALS - SUPABASE TO CLERK AUTHENTICATION SCHEMA MIGRATION
-- ====================================================================
-- Run this in the Supabase SQL Editor.
-- This script safely removes auth.users references and triggers,
-- adds Clerk columns and status/last_login_at fields, and defines
-- the public.auth_user_id() helper for RLS policies.
-- It dynamically adjusts to whichever tables are present in the target database.
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. DESTRUCTIVE CLEANUP (OLD TRIGGERS & FUNCTIONS)
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_profile_role_escalation();

-- --------------------------------------------------------------------
-- 2. CONDITIONAL TABLE CONSTRAINTS & AUDITING ALTERATIONS
-- --------------------------------------------------------------------
DO $$
BEGIN
  -- profiles table changes
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'clerk_user_id') THEN
      ALTER TABLE public.profiles ADD COLUMN clerk_user_id TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status') THEN
      ALTER TABLE public.profiles ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_login_at') THEN
      ALTER TABLE public.profiles ADD COLUMN last_login_at TIMESTAMPTZ;
    END IF;
  END IF;

  -- addresses constraints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'addresses') THEN
    ALTER TABLE public.addresses DROP CONSTRAINT IF EXISTS addresses_user_id_fkey;
    ALTER TABLE public.addresses 
      ADD CONSTRAINT addresses_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- carts constraints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'carts') THEN
    ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_user_id_fkey;
    ALTER TABLE public.carts 
      ADD CONSTRAINT carts_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- wishlists constraints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishlists') THEN
    ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
    ALTER TABLE public.wishlists 
      ADD CONSTRAINT wishlists_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- orders constraints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
    ALTER TABLE public.orders 
      ADD CONSTRAINT orders_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- notifications constraints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
    ALTER TABLE public.notifications 
      ADD CONSTRAINT notifications_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- product_interactions constraints
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_interactions') THEN
    ALTER TABLE public.product_interactions DROP CONSTRAINT IF EXISTS product_interactions_user_id_fkey;
    ALTER TABLE public.product_interactions 
      ADD CONSTRAINT product_interactions_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 3. IDENTITY INJECTION HELPER FOR RLS
-- --------------------------------------------------------------------
-- Resolves active profile UUID from Clerk text-based user ID in JWT 'sub' claim
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles 
  WHERE clerk_user_id = (auth.jwt() ->> 'sub');
$$;

-- --------------------------------------------------------------------
-- 4. ROLE & CAPABILITY PERMISSION RESOLVER
-- --------------------------------------------------------------------
-- Supports new RBAC tables schema, falls back to profile role string check
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  role_str TEXT;
BEGIN
  -- 1. Check if new role/permission schema tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
    RETURN EXISTS (
      SELECT 1 
      FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions perm ON rp.permission_id = perm.id
      WHERE p.id = user_id AND perm.name = perm_name AND COALESCE(p.is_active, true) = true
    );
  END IF;

  -- 2. Legacy fallback: check profile role column directly
  SELECT role INTO role_str FROM public.profiles WHERE id = user_id;
  RETURN COALESCE(role_str IN ('admin', 'super_admin'), false);
END;
$$;

-- --------------------------------------------------------------------
-- 5. CONDITIONAL RLS POLICIES REBUILD WITH DYNAMIC SQL
-- --------------------------------------------------------------------
DO $$
BEGIN
  -- 5.1 Profiles policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Allow users to select own profile" ON public.profiles';
    EXECUTE 'CREATE POLICY "Allow users to select own profile" ON public.profiles FOR SELECT USING (public.auth_user_id() = id OR public.has_permission(public.auth_user_id(), ''user:manage''))';
    EXECUTE 'DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles';
    EXECUTE 'CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE USING (public.auth_user_id() = id OR public.has_permission(public.auth_user_id(), ''user:manage''))';
  END IF;

  -- 5.2 Stores policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
    EXECUTE 'ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Merchants manage own stores" ON public.stores';
    EXECUTE 'CREATE POLICY "Merchants manage own stores" ON public.stores FOR ALL USING (seller_id = public.auth_user_id() OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
  END IF;

  -- 5.3 Products policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read on active listings" ON public.products';
    
    -- Handles legacy schemas where column is 'product_status', unified 'status', or fallback to no status column
    -- Also dynamically checks for stores table presence to avoid compiling issues on simple schemas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'product_status') THEN
        EXECUTE 'CREATE POLICY "Public read on active listings" ON public.products FOR SELECT USING (product_status = ''approved'' OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = public.auth_user_id()) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status') THEN
        EXECUTE 'CREATE POLICY "Public read on active listings" ON public.products FOR SELECT USING (status = ''approved'' OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = public.auth_user_id()) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSE
        EXECUTE 'CREATE POLICY "Public read on active listings" ON public.products FOR SELECT USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = public.auth_user_id()) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'product_status') THEN
        EXECUTE 'CREATE POLICY "Public read on active listings" ON public.products FOR SELECT USING (product_status = ''approved'' OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status') THEN
        EXECUTE 'CREATE POLICY "Public read on active listings" ON public.products FOR SELECT USING (status = ''approved'' OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSE
        EXECUTE 'CREATE POLICY "Public read on active listings" ON public.products FOR SELECT USING (true)';
      END IF;
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS "Merchants write products" ON public.products';
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
      EXECUTE 'CREATE POLICY "Merchants write products" ON public.products FOR ALL USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id AND s.seller_id = public.auth_user_id()) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
    ELSE
      EXECUTE 'CREATE POLICY "Merchants write products" ON public.products FOR ALL USING (public.has_permission(public.auth_user_id(), ''product:write'') OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
    END IF;
  END IF;

  -- 5.4 Variants policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_variants') THEN
    EXECUTE 'ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public read on active variant details" ON public.product_variants';
    
    -- Handles legacy schemas where products column is 'product_status', unified 'status', or fallback to no status column
    -- Also dynamically checks for stores table presence to avoid compiling issues on simple schemas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'product_status') THEN
        EXECUTE 'CREATE POLICY "Public read on active variant details" ON public.product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND (p.product_status = ''approved'' OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.seller_id = public.auth_user_id()))) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status') THEN
        EXECUTE 'CREATE POLICY "Public read on active variant details" ON public.product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND (p.status = ''approved'' OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.seller_id = public.auth_user_id()))) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSE
        EXECUTE 'CREATE POLICY "Public read on active variant details" ON public.product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.store_id AND s.seller_id = public.auth_user_id()))) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'product_status') THEN
        EXECUTE 'CREATE POLICY "Public read on active variant details" ON public.product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.product_status = ''approved'') OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'status') THEN
        EXECUTE 'CREATE POLICY "Public read on active variant details" ON public.product_variants FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.status = ''approved'') OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
      ELSE
        EXECUTE 'CREATE POLICY "Public read on active variant details" ON public.product_variants FOR SELECT USING (true)';
      END IF;
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS "Merchants manage variants" ON public.product_variants';
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
      EXECUTE 'CREATE POLICY "Merchants manage variants" ON public.product_variants FOR ALL USING (EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id WHERE p.id = product_variants.product_id AND s.seller_id = public.auth_user_id()) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
    ELSE
      EXECUTE 'CREATE POLICY "Merchants manage variants" ON public.product_variants FOR ALL USING (public.has_permission(public.auth_user_id(), ''product:write'') OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
    END IF;
  END IF;

  -- 5.5 Inventory policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory') THEN
    EXECUTE 'ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Inventory select protection" ON public.inventory';
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
      EXECUTE 'CREATE POLICY "Inventory select protection" ON public.inventory FOR SELECT USING (EXISTS (SELECT 1 FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id JOIN public.stores s ON s.id = p.store_id WHERE pv.id = inventory.variant_id AND s.seller_id = public.auth_user_id()) OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
    ELSE
      EXECUTE 'CREATE POLICY "Inventory select protection" ON public.inventory FOR SELECT USING (public.has_permission(public.auth_user_id(), ''product:write'') OR public.has_permission(public.auth_user_id(), ''product:moderation''))';
    END IF;
  END IF;

  -- 5.6 Orders & Items policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
    EXECUTE 'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users read own orders" ON public.orders';
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
      EXECUTE 'CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (public.auth_user_id() = user_id OR public.has_permission(public.auth_user_id(), ''order:read_all'') OR EXISTS (SELECT 1 FROM public.order_items oi JOIN public.product_variants pv ON pv.id = oi.variant_id JOIN public.products p ON p.id = pv.product_id JOIN public.stores s ON s.id = p.store_id WHERE oi.order_id = orders.id AND s.seller_id = public.auth_user_id()))';
    ELSE
      EXECUTE 'CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (public.auth_user_id() = user_id OR public.has_permission(public.auth_user_id(), ''order:read_all''))';
    END IF;
    EXECUTE 'DROP POLICY IF EXISTS "Users checkout placement" ON public.orders';
    EXECUTE 'CREATE POLICY "Users checkout placement" ON public.orders FOR INSERT WITH CHECK (public.auth_user_id() = user_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
    EXECUTE 'ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users view own items" ON public.order_items';
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
      EXECUTE 'CREATE POLICY "Users view own items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = public.auth_user_id() OR public.has_permission(public.auth_user_id(), ''order:read_all''))) OR EXISTS (SELECT 1 FROM public.product_variants pv JOIN public.products p ON p.id = pv.product_id JOIN public.stores s ON s.id = p.store_id WHERE pv.id = order_items.variant_id AND s.seller_id = public.auth_user_id()))';
    ELSE
      EXECUTE 'CREATE POLICY "Users view own items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = public.auth_user_id() OR public.has_permission(public.auth_user_id(), ''order:read_all''))))';
    END IF;
  END IF;

  -- 5.7 Storage objects policies
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
      EXECUTE 'DROP POLICY IF EXISTS "Avatars manage owner check" ON storage.objects';
      EXECUTE 'CREATE POLICY "Avatars manage owner check" ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''avatars'' AND (public.auth_user_id())::text = (storage.foldername(name))[1])';
    END IF;
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'seller-documents') THEN
      EXECUTE 'DROP POLICY IF EXISTS "Seller documents are private" ON storage.objects';
      EXECUTE 'CREATE POLICY "Seller documents are private" ON storage.objects FOR ALL TO authenticated USING (bucket_id = ''seller-documents'' AND ((public.auth_user_id())::text = (storage.foldername(name))[1] OR public.has_permission(public.auth_user_id(), ''user:manage'')))';
    END IF;
  END IF;
END $$;

COMMIT;
