-- ============================================================
-- GREVYA E-COMMERCE ROW LEVEL SECURITY (RLS) POLICIES
-- Customer, Seller & Admin Access Control Configuration
-- ============================================================


-- ------------------------------------------------------------
-- ADDRESSES
-- ------------------------------------------------------------

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can select own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;

CREATE POLICY "Users manage own addresses"
ON public.addresses
FOR ALL
TO public
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);


-- ------------------------------------------------------------
-- CARTS
-- ------------------------------------------------------------

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own cart" ON public.carts;
DROP POLICY IF EXISTS "Users can insert own cart" ON public.carts;
DROP POLICY IF EXISTS "Users can update own cart" ON public.carts;
DROP POLICY IF EXISTS "Users can delete own cart" ON public.carts;
DROP POLICY IF EXISTS "Users manage own cart" ON public.carts;

CREATE POLICY "Users manage own cart"
ON public.carts
FOR ALL
TO public
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);

-- ------------------------------------------------------------
-- CONTACT MESSAGES
-- ------------------------------------------------------------

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read all contact messages"
ON public.contact_messages;

DROP POLICY IF EXISTS "Admin can update contact messages"
ON public.contact_messages;

DROP POLICY IF EXISTS "Public can submit contact messages"
ON public.contact_messages;

CREATE POLICY "Public can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  true
);

CREATE POLICY "Admin can read all contact messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin can update contact messages"
ON public.contact_messages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- ------------------------------------------------------------
-- NEWSLETTER SUBSCRIBERS
-- ------------------------------------------------------------

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read newsletter subscribers"
ON public.newsletter_subscribers;

DROP POLICY IF EXISTS "Admin can update newsletter subscribers"
ON public.newsletter_subscribers;

DROP POLICY IF EXISTS "Public can subscribe to newsletter"
ON public.newsletter_subscribers;

CREATE POLICY "Public can subscribe to newsletter"
ON public.newsletter_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (
  true
);

CREATE POLICY "Admin can read newsletter subscribers"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admin can update newsletter subscribers"
ON public.newsletter_subscribers
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert notifications"
ON public.notifications;

DROP POLICY IF EXISTS "Users can insert own notifications"
ON public.notifications;

DROP POLICY IF EXISTS "Users can select own notifications"
ON public.notifications;

DROP POLICY IF EXISTS "Users view own notifications"
ON public.notifications;

DROP POLICY IF EXISTS "Users can update own notifications"
ON public.notifications;

CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
);

CREATE POLICY "Users view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
)
WITH CHECK (
  auth.uid() = user_id
);



-- ------------------------------------------------------------
-- ORDER ITEMS
-- ------------------------------------------------------------

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select all order items"
ON public.order_items;

DROP POLICY IF EXISTS "Users can insert owned order items"
ON public.order_items;

DROP POLICY IF EXISTS "Users can select owned order items"
ON public.order_items;

DROP POLICY IF EXISTS "Users view own order items"
ON public.order_items;

CREATE POLICY "Admins can select all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  public.is_admin()
);

CREATE POLICY "Users can insert owned order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
  )
);

CREATE POLICY "Users view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- ORDER STATUS HISTORY
-- ------------------------------------------------------------

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read owned status history"
ON public.order_status_history;

DROP POLICY IF EXISTS "Users view own tracking"
ON public.order_status_history;

CREATE POLICY "Users view own tracking"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_status_history.order_id
      AND orders.user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- ORDERS POLICIES
-- ------------------------------------------------------------

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Admin can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can delete all orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can select all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update orders containing their products" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view orders containing their products" ON public.orders;
DROP POLICY IF EXISTS "Users can access own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can select own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;



CREATE POLICY "Users can view own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
);

CREATE POLICY "Users can create own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

CREATE POLICY "Users can update pending own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
    AND order_status = 'pending'
)
WITH CHECK (
    auth.uid() = user_id
    AND order_status = 'pending'
);


CREATE POLICY "Sellers can view relevant orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
    public.can_access_order_via_product(id)
);


CREATE POLICY "Sellers can update relevant orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
    public.can_access_order_via_product(id)
)
WITH CHECK (
    public.can_access_order_via_product(id)
);


CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

-- ------------------------------------------------------------
-- REVIEWS POLICIES
-- ------------------------------------------------------------

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for all" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;


CREATE POLICY "Allow select for all"
ON public.reviews
FOR SELECT
TO public
USING (
    true
);

CREATE POLICY "Authenticated users can insert reviews"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);



-- ------------------------------------------------------------
-- WISHLISTS POLICIES
-- ------------------------------------------------------------

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own wishlist" ON public.wishlists;
DROP POLICY IF EXISTS "Users can insert own wishlist" ON public.wishlists;
DROP POLICY IF EXISTS "Users can select own wishlist" ON public.wishlists;

CREATE POLICY "Users can select own wishlist"
ON public.wishlists
FOR SELECT
TO public
USING (
    auth.uid() = user_id
);

CREATE POLICY "Users can insert own wishlist"
ON public.wishlists
FOR INSERT
TO public
WITH CHECK (
    auth.uid() = user_id
);

CREATE POLICY "Users can delete own wishlist"
ON public.wishlists
FOR DELETE
TO public
USING (
    auth.uid() = user_id
);


-- ------------------------------------------------------------
-- PRODUCTS POLICIES
-- ------------------------------------------------------------

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update any product" ON public.products;
DROP POLICY IF EXISTS "Admins can delete any product" ON public.products;
DROP POLICY IF EXISTS "Seller can select own products" ON public.products;
DROP POLICY IF EXISTS "Seller can insert own products" ON public.products;
DROP POLICY IF EXISTS "Seller can update own products" ON public.products;
DROP POLICY IF EXISTS "Seller can delete own products" ON public.products;


CREATE POLICY "Public can view products"
ON public.products
FOR SELECT
TO public
USING (true);


CREATE POLICY "Sellers can create own products"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
    seller_id = auth.uid()
);

CREATE POLICY "Sellers can update own products"
ON public.products
FOR UPDATE
TO authenticated
USING (
    seller_id = auth.uid()
)
WITH CHECK (
    seller_id = auth.uid()
);

CREATE POLICY "Sellers can delete own products"
ON public.products
FOR DELETE
TO authenticated
USING (
    seller_id = auth.uid()
);


CREATE POLICY "Admins can manage all products"
ON public.products
FOR ALL
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);


-- ------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can create their own profiles and admin can" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view their own profiles and admin can" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update their own profiles and admin can" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can delete their own profiles and admin can" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;


CREATE POLICY "Users can create own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = id
);

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    auth.uid() = id
);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    auth.uid() = id
)
WITH CHECK (
    auth.uid() = id
);


CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);