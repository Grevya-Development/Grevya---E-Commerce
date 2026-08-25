-- ====================================================================
-- ORDER STATE MACHINE IMPLEMENTATION
-- ====================================================================
-- This migration adds production-grade order management with:
-- - Order status state machine enforcement
-- - Payment status state machine enforcement  
-- - Order history audit trail
-- - Role-based permission checks
-- - Backend validation of all transitions
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. ALTER ORDERS TABLE: ADD MISSING FIELDS
-- ====================================================================

-- Add payment_status field (separate from order status)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refund_processing', 'refunded'));

-- Add tracking_number field for shipments
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- Add estimated_delivery field
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ;

-- Replace legacy payment checks that do not include refund_processing.
DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.orders'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%payment_status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS %I',
      constraint_row.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_status_check
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refund_processing', 'refunded'));

-- Update order status constraint to include new statuses
ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check CHECK (
  status IN (
    'pending', 'confirmed', 'processing', 'shipped', 
    'in_transit', 'out_for_delivery', 'delivered', 
    'cancelled', 'returned'
  )
);

-- Resolve permissions from the profile role, with JWT fallback for legacy sessions.
CREATE OR REPLACE FUNCTION public.has_permission(user_uuid UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH resolved_role AS (
    SELECT COALESCE(
      (
        SELECT p.role
        FROM public.profiles p
        WHERE p.id = user_uuid
          AND p.is_active = true
      ),
      NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', ''),
      NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', '')
    ) AS role_name
  )
  SELECT CASE
    WHEN user_uuid IS DISTINCT FROM auth.uid() THEN false
    WHEN role_name IN ('admin', 'super_admin') THEN true
    WHEN perm_name = 'product:write' AND role_name = 'seller' THEN true
    WHEN perm_name = 'product:moderation' AND role_name IN ('admin', 'super_admin') THEN true
    WHEN perm_name = 'order:write_status' AND role_name IN ('seller', 'admin', 'super_admin') THEN true
    WHEN perm_name = 'order:read_all' AND role_name IN ('admin', 'super_admin') THEN true
    WHEN perm_name = 'user:manage' AND role_name IN ('admin', 'super_admin') THEN true
    WHEN perm_name = 'system:settings' AND role_name = 'super_admin' THEN true
    WHEN perm_name = 'audit:read' AND role_name IN ('admin', 'super_admin') THEN true
    ELSE false
  END
  FROM resolved_role;
$$;

-- Validate order status transitions
CREATE OR REPLACE FUNCTION public.is_valid_order_status_transition(
  current_status TEXT,
  next_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Same status = valid (no-op)
  IF current_status = next_status THEN
    RETURN TRUE;
  END IF;

  -- Define valid transitions using a state machine
  RETURN CASE current_status
    WHEN 'pending' THEN next_status IN ('confirmed', 'cancelled')
    WHEN 'confirmed' THEN next_status IN ('processing', 'cancelled')
    WHEN 'processing' THEN next_status IN ('shipped', 'cancelled')
    WHEN 'shipped' THEN next_status = 'in_transit'
    WHEN 'in_transit' THEN next_status = 'out_for_delivery'
    WHEN 'out_for_delivery' THEN next_status = 'delivered'
    WHEN 'delivered' THEN next_status = 'returned'
    WHEN 'cancelled' THEN FALSE  -- No transitions from cancelled
    WHEN 'returned' THEN FALSE   -- No transitions from returned
    ELSE FALSE
  END;
END;
$$;

-- Validate payment status transitions
CREATE OR REPLACE FUNCTION public.is_valid_payment_status_transition(
  current_status TEXT,
  next_status TEXT,
  payment_method TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Same status = valid (no-op)
  IF current_status = next_status THEN
    RETURN TRUE;
  END IF;

  -- Payment method is available for method-specific business rules in the RPC.
  -- COD follows the same state machine, but cannot be refunded before collection.
  RETURN CASE current_status
    WHEN 'pending' THEN next_status IN ('paid', 'failed')
    WHEN 'paid' THEN next_status = 'refund_processing'
    WHEN 'failed' THEN FALSE
    WHEN 'refund_processing' THEN next_status = 'refunded'
    WHEN 'refunded' THEN FALSE  -- No transitions from refunded
    ELSE FALSE
  END;
END;
$$;

-- ====================================================================
-- 3. CREATE ORDER UPDATE RPC FUNCTION WITH VALIDATION
-- ====================================================================

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_new_order_status TEXT DEFAULT NULL,
  p_new_payment_status TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_estimated_delivery TIMESTAMPTZ DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  order_id UUID,
  new_order_status TEXT,
  new_payment_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_order_status TEXT;
  v_current_payment_status TEXT;
  v_payment_method TEXT;
  v_user_id UUID;
  v_user_role TEXT;
  v_final_order_status TEXT;
  v_final_payment_status TEXT;
  v_order_exists BOOLEAN;
BEGIN
  -- Get authenticated user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Not authenticated'::TEXT, p_order_id, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Get user role
  v_user_role := COALESCE(
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', '')
  );

  -- Check permission: must have order:write_status permission
  IF NOT public.has_permission(v_user_id, 'order:write_status') THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Insufficient permissions to modify orders'::TEXT, p_order_id, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Get current order status
  SELECT o.status, o.payment_status, o.payment_method
  INTO v_current_order_status, v_current_payment_status, v_payment_method
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF v_current_order_status IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Order not found'::TEXT, p_order_id, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- Default to current values if not provided
  v_final_order_status := COALESCE(p_new_order_status, v_current_order_status);
  v_final_payment_status := COALESCE(p_new_payment_status, v_current_payment_status);

  -- COD is collected only when delivery is completed. Derive this payment
  -- transition in the same order update so the two values are atomic.
  IF LOWER(COALESCE(v_payment_method, '')) = 'cod' THEN
    IF v_final_order_status = 'delivered' THEN
      v_final_payment_status := 'paid';
    ELSIF v_final_payment_status = 'paid' AND v_current_payment_status <> 'paid' THEN
      RETURN QUERY SELECT
        FALSE,
        'COD payment cannot be marked paid before delivery'::TEXT,
        p_order_id,
        NULL::TEXT,
        NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Validate order status transition
  IF p_new_order_status IS NOT NULL AND NOT public.is_valid_order_status_transition(v_current_order_status, v_final_order_status) THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Invalid status transition: ' || v_current_order_status || ' → ' || v_final_order_status,
      p_order_id, 
      NULL::TEXT, 
      NULL::TEXT;
    RETURN;
  END IF;

  -- Validate payment status transition
  IF p_new_payment_status IS NOT NULL AND NOT public.is_valid_payment_status_transition(
    v_current_payment_status,
    v_final_payment_status,
    v_payment_method
  ) THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Invalid payment status transition: ' || v_current_payment_status || ' → ' || v_final_payment_status,
      p_order_id, 
      NULL::TEXT, 
      NULL::TEXT;
    RETURN;
  END IF;

  -- Refunds require a successfully collected payment and the explicit
  -- refund_processing step. This guard remains even if the state function
  -- is changed later.
  IF p_new_payment_status = 'refund_processing' AND v_current_payment_status <> 'paid' THEN
    RETURN QUERY SELECT
      FALSE,
      'Refund processing requires a paid payment'::TEXT,
      p_order_id,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  IF p_new_payment_status = 'refunded' AND v_current_payment_status <> 'refund_processing' THEN
    RETURN QUERY SELECT
      FALSE,
      'Payment must be in refund processing before it can be refunded'::TEXT,
      p_order_id,
      NULL::TEXT,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Enforce business rules
  -- Rule: Cannot set payment to 'paid' for cancelled orders
  IF v_final_order_status = 'cancelled' AND v_final_payment_status = 'paid' THEN
    RETURN QUERY SELECT 
      FALSE, 
      'Business rule violation: Cannot mark cancelled order as paid',
      p_order_id, 
      NULL::TEXT, 
      NULL::TEXT;
    RETURN;
  END IF;

  -- Rule: Require tracking number for shipped status
  IF v_final_order_status = 'shipped' AND (p_tracking_number IS NULL OR TRIM(p_tracking_number) = '') THEN
    -- Check if tracking number already exists
    IF (SELECT tracking_number FROM public.orders WHERE id = p_order_id) IS NULL THEN
      RETURN QUERY SELECT 
        FALSE, 
        'Tracking number required when transitioning to shipped status',
        p_order_id, 
        NULL::TEXT, 
        NULL::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Update the order
  UPDATE public.orders
  SET
    status = v_final_order_status,
    payment_status = v_final_payment_status,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    estimated_delivery = COALESCE(p_estimated_delivery, estimated_delivery),
    updated_at = now()
  WHERE id = p_order_id;

  -- Create audit trail entry
  INSERT INTO public.order_status_history (
    order_id,
    status,
    payment_status,
    notes,
    changed_by,
    created_at
  )
  VALUES (
    p_order_id,
    v_final_order_status,
    v_final_payment_status,
    CASE
      WHEN LOWER(COALESCE(v_payment_method, '')) = 'cod'
        AND v_final_order_status = 'delivered'
        AND v_current_payment_status <> 'paid'
      THEN 'COD payment marked paid automatically after delivery'
      ELSE COALESCE(
        p_reason,
        CASE
          WHEN p_new_payment_status IS NOT NULL
            AND p_new_payment_status <> v_current_payment_status
          THEN 'Payment status updated from ' || v_current_payment_status || ' to ' || v_final_payment_status
          ELSE 'Status updated to ' || v_final_order_status
        END
      )
    END,
    v_user_id,
    now()
  );

  -- Return success
  RETURN QUERY SELECT 
    TRUE,
    'Order status updated successfully'::TEXT,
    p_order_id,
    v_final_order_status,
    v_final_payment_status;
END;
$$;

-- ====================================================================
-- 4. ADD UPDATE RLS POLICY TO ORDERS TABLE
-- ====================================================================

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Orders update by admin only" ON public.orders;
DROP POLICY IF EXISTS "Users update own order notes" ON public.orders;
DROP POLICY IF EXISTS "Admin update orders via RPC" ON public.orders;

-- New update policy: only admin/super_admin with order:write_status can update via this policy
-- Most updates should use the RPC function instead
CREATE POLICY "Admin update orders via RPC" ON public.orders
    FOR UPDATE USING (public.has_permission(auth.uid(), 'order:write_status'))
    WITH CHECK (public.has_permission(auth.uid(), 'order:write_status'));

-- ====================================================================
-- 5. ENSURE ORDER_STATUS_HISTORY TABLE EXISTS WITH REQUIRED FIELDS
-- ====================================================================

-- Note: This table should already exist from master schema, but verify structure
-- Verify the table has all required fields
DO $$
BEGIN
  -- Check if status field exists and is not null constrained
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_status_history' 
    AND column_name = 'status'
  ) THEN
    ALTER TABLE public.order_status_history ADD COLUMN status TEXT;
  END IF;
END;
$$;

ALTER TABLE public.order_status_history
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.order_status_history
ADD COLUMN IF NOT EXISTS changed_by UUID;

ALTER TABLE public.order_status_history
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.order_status_history
ADD COLUMN IF NOT EXISTS payment_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_status_history_payment_status_check'
      AND conrelid = 'public.order_status_history'::regclass
  ) THEN
    ALTER TABLE public.order_status_history
    ADD CONSTRAINT order_status_history_payment_status_check
    CHECK (payment_status IS NULL OR payment_status IN ('pending', 'paid', 'failed', 'refund_processing', 'refunded'));
  END IF;
END;
$$;

-- Protect the table itself so direct API updates cannot bypass the state machine.
CREATE OR REPLACE FUNCTION public.validate_order_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(COALESCE(NEW.payment_method, '')) = 'cod' THEN
    IF NEW.status = 'delivered' THEN
      NEW.payment_status := 'paid';
    ELSIF NEW.payment_status = 'paid' AND OLD.payment_status <> 'paid' THEN
      RAISE EXCEPTION 'COD payment cannot be marked paid before delivery';
    END IF;
  END IF;

  IF NOT public.is_valid_order_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
  END IF;

  IF NOT public.is_valid_payment_status_transition(OLD.payment_status, NEW.payment_status, NEW.payment_method) THEN
    RAISE EXCEPTION 'Invalid payment status transition: % -> %', OLD.payment_status, NEW.payment_status;
  END IF;

  IF NEW.payment_status IN ('refund_processing', 'refunded')
    AND OLD.payment_status <> 'paid'
    AND NOT (NEW.payment_status = 'refunded' AND OLD.payment_status = 'refund_processing') THEN
    RAISE EXCEPTION 'Refund requires a paid payment and the refund_processing step';
  END IF;

  IF NEW.status = 'cancelled' AND NEW.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Cannot mark a cancelled order as paid';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_validate_status_update ON public.orders;
CREATE TRIGGER orders_validate_status_update
BEFORE UPDATE OF status, payment_status, payment_method ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_status_update();

-- ====================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_status_payment ON public.orders(status, payment_status);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id, created_at DESC);

-- ====================================================================
-- 7. ADD HELPER FUNCTION TO GET VALID NEXT STATUSES
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_valid_order_status_transitions(
  current_status TEXT
)
RETURNS TABLE (valid_status TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT UNNEST(
    CASE current_status
      WHEN 'pending' THEN ARRAY['confirmed', 'cancelled']
      WHEN 'confirmed' THEN ARRAY['processing', 'cancelled']
      WHEN 'processing' THEN ARRAY['shipped', 'cancelled']
      WHEN 'shipped' THEN ARRAY['in_transit']
      WHEN 'in_transit' THEN ARRAY['out_for_delivery']
      WHEN 'out_for_delivery' THEN ARRAY['delivered']
      WHEN 'delivered' THEN ARRAY['returned']
      ELSE ARRAY[]::TEXT[]
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_valid_payment_status_transitions(
  current_status TEXT
)
RETURNS TABLE (valid_status TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT UNNEST(
    CASE current_status
      WHEN 'pending' THEN ARRAY['paid', 'failed']
      WHEN 'paid' THEN ARRAY['refund_processing']
      WHEN 'failed' THEN ARRAY[]::TEXT[]
      WHEN 'refund_processing' THEN ARRAY['refunded']
      ELSE ARRAY[]::TEXT[]
    END
  );
END;
$$;

COMMIT;
