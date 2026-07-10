-- ====================================================================
-- GREVYA E-COMMERCE - ADMIN PROFILE MANAGEMENT RLS REPAIRS
-- Run this in the Supabase SQL Editor to allow admins to view/manage users.
-- ====================================================================

-- 1. Enable RLS on profiles table (defensive check)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies on profiles table
DROP POLICY IF EXISTS "Profiles are user owned" ON public.profiles;
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3. Create new RLS policies for profiles table

-- SELECT Policy: A user can read their own profile, an admin can read all profiles, 
-- and a seller can read profiles of users who placed orders containing their products.
CREATE POLICY "Profiles are selectable by own user, admins, or sellers of their orders" 
  ON public.profiles FOR SELECT 
  USING (
    auth.uid() = id 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.order_items oi ON o.id = oi.order_id
      JOIN public.products p ON oi.product_id = p.id
      WHERE o.user_id = profiles.id AND p.seller_id = auth.uid()
    )
  );

-- INSERT Policy: Users can only insert their own profile row.
CREATE POLICY "Profiles are insertable by own user" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- UPDATE Policy: A user can update their own profile, and admins can update any profile (e.g. for role updates or blocking).
CREATE POLICY "Profiles are updatable by own user or admin" 
  ON public.profiles FOR UPDATE 
  USING (
    auth.uid() = id 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    auth.uid() = id 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
