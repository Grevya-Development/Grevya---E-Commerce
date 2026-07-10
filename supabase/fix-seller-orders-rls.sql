-- ====================================================================
-- GREVYA E-COMMERCE - SELLER ORDER ACCESS & RPC SETUP
-- Run this in the Supabase SQL Editor to install seller order functions and RLS policies.
-- ====================================================================

-- 1. Create or replace get_seller_order_items function
CREATE OR REPLACE FUNCTION public.get_seller_order_items()
RETURNS TABLE (
  id uuid,
  order_id uuid,
  product_id bigint,
  product_name text,
  product_image text,
  quantity integer,
  price numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_image,
    oi.quantity,
    oi.price,
    oi.created_at
  FROM public.order_items oi
  JOIN public.products p ON oi.product_id = p.id
  WHERE p.seller_id = auth.uid();
END;
$$;

-- 2. Create or replace get_seller_order_items_v2 function
CREATE OR REPLACE FUNCTION public.get_seller_order_items_v2()
RETURNS TABLE (
  id uuid,
  order_id uuid,
  product_id bigint,
  product_name text,
  product_image text,
  quantity integer,
  price numeric,
  created_at timestamptz,
  order_status text,
  payment_status text,
  tracking_number text,
  estimated_delivery timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_image,
    oi.quantity,
    oi.price,
    oi.created_at,
    o.status AS order_status,
    o.payment_status,
    o.tracking_number,
    o.estimated_delivery
  FROM public.order_items oi
  JOIN public.products p ON oi.product_id = p.id
  JOIN public.orders o ON oi.order_id = o.id
  WHERE p.seller_id = auth.uid();
END;
$$;

-- Grant permissions for authenticated sellers/admins to invoke these functions
GRANT EXECUTE ON FUNCTION public.get_seller_order_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_order_items_v2() TO authenticated;

-- 3. Update orders table RLS policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders are user owned" ON public.orders;
DROP POLICY IF EXISTS "Users can select own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are selectable by own user, admins, or sellers of their items" ON public.orders;
DROP POLICY IF EXISTS "Orders are updatable by own user, admins, or sellers of their items" ON public.orders;

-- SELECT Policy
CREATE POLICY "Orders are selectable by own user, admins, or sellers of their items"
  ON public.orders FOR SELECT
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON oi.product_id = p.id
      WHERE oi.order_id = orders.id AND p.seller_id = auth.uid()
    )
  );

-- INSERT Policy
CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE Policy
CREATE POLICY "Orders are updatable by own user, admins, or sellers of their items"
  ON public.orders FOR UPDATE
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON oi.product_id = p.id
      WHERE oi.order_id = orders.id AND p.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON oi.product_id = p.id
      WHERE oi.order_id = orders.id AND p.seller_id = auth.uid()
    )
  );

-- 4. Update order_items table RLS policies
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read owned order items" ON public.order_items;
DROP POLICY IF EXISTS "Users insert owned order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can select owned order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert owned order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items are selectable by purchaser, admins, or sellers" ON public.order_items;

-- SELECT Policy
CREATE POLICY "Order items are selectable by purchaser, admins, or sellers"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = order_items.product_id AND products.seller_id = auth.uid()
    )
  );

-- INSERT Policy
CREATE POLICY "Users can insert owned order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
  );

-- 5. Update addresses table RLS policies
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Addresses are user owned" ON public.addresses;
DROP POLICY IF EXISTS "Users can select own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Addresses are selectable by owner, admins, or sellers of their orders" ON public.addresses;

-- SELECT Policy
CREATE POLICY "Addresses are selectable by owner, admins, or sellers of their orders"
  ON public.addresses FOR SELECT
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.order_items oi ON o.id = oi.order_id
      JOIN public.products p ON oi.product_id = p.id
      WHERE o.user_id = addresses.user_id AND p.seller_id = auth.uid()
    )
  );

-- INSERT Policy
CREATE POLICY "Users can insert own addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE Policy
CREATE POLICY "Users can update own addresses"
  ON public.addresses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE Policy
CREATE POLICY "Users can delete own addresses"
  ON public.addresses FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Update notifications table RLS policies (allow admins to insert notifications for other users)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications are user owned" ON public.notifications;
DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are selectable by owner" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are insertable by owner or admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are updatable by owner" ON public.notifications;

-- SELECT Policy
CREATE POLICY "Notifications are selectable by owner"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT Policy
CREATE POLICY "Notifications are insertable by owner or admin"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- UPDATE Policy
CREATE POLICY "Notifications are updatable by owner"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Update products table RLS policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Products are publicly readable if approved" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete own products" ON public.products;
DROP POLICY IF EXISTS "Admins can do anything on products" ON public.products;

-- SELECT Policy (Anyone can read approved products, sellers can read theirs, admins can read all)
CREATE POLICY "Products are publicly readable if approved"
  ON public.products FOR SELECT
  USING (
    product_status = 'approved'
    OR seller_id = auth.uid()
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- INSERT Policy (Sellers can insert their own products)
CREATE POLICY "Sellers can insert own products"
  ON public.products FOR INSERT
  WITH CHECK (
    seller_id = auth.uid()
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'seller'
  );

-- UPDATE Policy (Sellers can update their own products)
CREATE POLICY "Sellers can update own products"
  ON public.products FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- DELETE Policy (Sellers can delete their own products)
CREATE POLICY "Sellers can delete own products"
  ON public.products FOR DELETE
  USING (seller_id = auth.uid());

-- ALL Policy (Admins can manage any product)
CREATE POLICY "Admins can do anything on products"
  ON public.products FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
