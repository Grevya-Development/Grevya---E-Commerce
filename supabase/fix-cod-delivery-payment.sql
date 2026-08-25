-- Align an already-deployed database with the COD delivery rule.
-- This migration is safe to run more than once.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_cod_delivery_payment()
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enforce_cod_delivery_payment ON public.orders;
CREATE TRIGGER orders_enforce_cod_delivery_payment
BEFORE UPDATE OF status, payment_status, payment_method ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_cod_delivery_payment();

-- Repair only the known inconsistent COD state. No other orders are changed.
-- A history row is added when an admin profile is available.
DO $$
DECLARE
  v_changed_by UUID;
  v_inconsistent_count INTEGER;
BEGIN
  SELECT id INTO v_changed_by
  FROM public.profiles
  WHERE role IN ('admin', 'super_admin')
  ORDER BY created_at NULLS LAST
  LIMIT 1;

  SELECT COUNT(*) INTO v_inconsistent_count
  FROM public.orders
  WHERE LOWER(COALESCE(payment_method, '')) = 'cod'
    AND status = 'delivered'
    AND payment_status = 'pending';

  IF v_inconsistent_count > 0 AND v_changed_by IS NULL THEN
    RAISE EXCEPTION
      'Cannot repair % inconsistent COD order(s): no admin profile is available for the required history record',
      v_inconsistent_count;
  END IF;

  WITH repaired AS (
    UPDATE public.orders
    SET payment_status = 'paid', updated_at = now()
    WHERE LOWER(COALESCE(payment_method, '')) = 'cod'
      AND status = 'delivered'
      AND payment_status = 'pending'
    RETURNING id
  )
  INSERT INTO public.order_status_history (
    order_id, status, payment_status, notes, changed_by, created_at
  )
  SELECT
    repaired.id,
    'delivered',
    'paid',
    'COD payment repaired to paid for an already delivered order',
    v_changed_by,
    now()
  FROM repaired;
END;
$$;

COMMIT;