-- ============================================================
-- MIGRATION 001: SECURE ORDER & PAYMENT WORKFLOW
-- ============================================================

-- ============================================================
-- A. VALIDATE STATUS VALUES
-- ============================================================
-- Convert existing invalid statuses to 'pending' to avoid violating constraints.
UPDATE public.orders
SET order_status = 'pending'
WHERE order_status NOT IN (
  'pending', 'confirmed', 'processing', 'shipped',
  'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'
) OR order_status IS NULL;

UPDATE public.orders
SET payment_status = 'pending'
WHERE payment_status NOT IN (
  'pending', 'paid', 'failed', 'refund_processing', 'refunded'
) OR payment_status IS NULL;

-- Keep `status` column in sync with `order_status` if it exists.
UPDATE public.orders
SET status = order_status
WHERE status IS NULL OR status <> order_status;

-- Add strict check constraints to orders table
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_order_status_check CHECK (
  order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned')
);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('pending', 'paid', 'failed', 'refund_processing', 'refunded')
);

-- ============================================================
-- B. AUDIT TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_status_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_by_role text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_status_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_by_role text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id text PRIMARY KEY,
  event_type text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on audit tables
ALTER TABLE public.order_status_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_status_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all audits
DROP POLICY IF EXISTS "Admins can view order status audits" ON public.order_status_audit;
CREATE POLICY "Admins can view order status audits"
  ON public.order_status_audit FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view payment status audits" ON public.payment_status_audit;
CREATE POLICY "Admins can view payment status audits"
  ON public.payment_status_audit FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================
-- C. SECURE ORDER STATUS RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_order public.orders;
  v_old_status text;
  v_is_seller_involved boolean;
BEGIN
  -- 1. Authentication
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request.';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

  IF v_actor_role NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and sellers can update order status. Your role: %', COALESCE(v_actor_role, 'none');
  END IF;

  -- 2. Fetch order and lock for update
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  
  v_old_status := v_order.order_status;
  
  -- If status is already the target status, just return the order
  IF v_old_status = p_new_status THEN
    RETURN v_order;
  END IF;

  -- 3. Role-specific validation
  IF v_actor_role = 'seller' THEN
    -- Check if seller has products in this order
    SELECT EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = p_order_id AND p.seller_id = v_actor_id
    ) INTO v_is_seller_involved;

    IF NOT v_is_seller_involved THEN
      RAISE EXCEPTION 'Unauthorized: You do not have products in this order.';
    END IF;

    -- Validate seller transitions
    IF p_new_status NOT IN ('confirmed', 'processing', 'shipped', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid target status for seller: %', p_new_status;
    END IF;

    IF NOT (
      (v_old_status = 'pending' AND p_new_status IN ('confirmed', 'cancelled')) OR
      (v_old_status = 'confirmed' AND p_new_status IN ('processing', 'cancelled')) OR
      (v_old_status = 'processing' AND p_new_status IN ('shipped', 'cancelled'))
    ) THEN
      RAISE EXCEPTION 'Invalid order status transition for seller: % -> %', v_old_status, p_new_status;
    END IF;
  ELSE
    -- Admin validations
    IF NOT (
      (v_old_status = 'pending' AND p_new_status IN ('confirmed', 'cancelled')) OR
      (v_old_status = 'confirmed' AND p_new_status IN ('processing', 'cancelled')) OR
      (v_old_status = 'processing' AND p_new_status IN ('shipped', 'cancelled')) OR
      (v_old_status = 'shipped' AND p_new_status IN ('in_transit', 'returned', 'cancelled')) OR
      (v_old_status = 'in_transit' AND p_new_status IN ('out_for_delivery', 'returned')) OR
      (v_old_status = 'out_for_delivery' AND p_new_status IN ('delivered', 'returned')) OR
      (v_old_status = 'delivered' AND p_new_status = 'returned')
    ) THEN
      RAISE EXCEPTION 'Invalid order status transition for admin: % -> %', v_old_status, p_new_status;
    END IF;
  END IF;

  -- 4. Set session config to bypass the trigger check temporarily
  PERFORM set_config('app.allow_status_update', 'true', true);

  -- 5. Execute Update
  UPDATE public.orders
  SET 
    order_status = p_new_status,
    status = p_new_status,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  -- 6. Record Audit Trail
  INSERT INTO public.order_status_audit (
    order_id, old_status, new_status, changed_by, changed_by_role, reason
  ) VALUES (
    p_order_id, v_old_status, p_new_status, v_actor_id, v_actor_role, p_reason
  );

  -- 7. Reset session config
  PERFORM set_config('app.allow_status_update', 'false', true);

  RETURN v_order;
END;
$$;


-- ============================================================
-- D. SECURE PAYMENT STATUS RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_order_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_order public.orders;
  v_old_status text;
BEGIN
  -- 1. Authentication
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request.';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

  IF v_actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update payment status.';
  END IF;

  -- 2. Fetch order and lock for update
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;
  
  v_old_status := v_order.payment_status;

  IF v_old_status = p_new_status THEN
    RETURN v_order;
  END IF;

  -- 3. Validate transition
  -- Admins can only manually trigger refund_processing. 
  -- They cannot manually set refunded directly.
  IF p_new_status = 'refunded' THEN
    RAISE EXCEPTION 'Invalid transition: refunded status must be handled by a secure webhook.';
  END IF;

  IF NOT (
    (v_old_status = 'pending' AND p_new_status IN ('paid', 'failed')) OR
    (v_old_status = 'paid' AND p_new_status = 'refund_processing') OR
    (v_old_status = 'failed' AND p_new_status = 'pending')
  ) THEN
    RAISE EXCEPTION 'Invalid payment status transition: % -> %', v_old_status, p_new_status;
  END IF;

  IF p_new_status = 'refund_processing' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'A valid reason must be provided when initiating a refund.';
  END IF;

  -- 4. Set session config to bypass the trigger check temporarily
  PERFORM set_config('app.allow_status_update', 'true', true);

  -- 5. Execute Update
  UPDATE public.orders
  SET 
    payment_status = p_new_status,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  -- 6. Record Audit Trail
  INSERT INTO public.payment_status_audit (
    order_id, old_status, new_status, changed_by, changed_by_role, reason
  ) VALUES (
    p_order_id, v_old_status, p_new_status, v_actor_id, v_actor_role, p_reason
  );

  -- 7. Reset session config
  PERFORM set_config('app.allow_status_update', 'false', true);

  RETURN v_order;
END;
$$;

-- ============================================================
-- E. PROTECT AGAINST DIRECT STATUS UPDATES
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_order_status_direct_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the update changes the status columns directly and isn't authorized by our RPCs
  IF (NEW.order_status IS DISTINCT FROM OLD.order_status) 
     OR (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
     OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    
    IF current_setting('app.allow_status_update', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Direct updates to order_status, payment_status, and status are restricted. Use appropriate RPCs (update_order_status, update_payment_status).';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_status ON public.orders;
CREATE TRIGGER trg_guard_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_status_direct_change();


-- ============================================================
-- F. DELIVERY DETAILS RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_delivery_details(
  p_order_id uuid,
  p_tracking_number text,
  p_estimated_delivery timestamptz
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_order public.orders;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request.';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

  IF v_actor_role NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and sellers can update delivery details.';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  IF v_actor_role = 'seller' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = p_order_id AND p.seller_id = v_actor_id
    ) THEN
      RAISE EXCEPTION 'Unauthorized: You do not have products in this order.';
    END IF;
  END IF;

  UPDATE public.orders
  SET 
    tracking_number = p_tracking_number,
    estimated_delivery = p_estimated_delivery,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

-- ============================================================
-- G. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_status_audit_order_id_changed_at ON public.order_status_audit(order_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_status_audit_order_id_changed_at ON public.payment_status_audit(order_id, changed_at DESC);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
