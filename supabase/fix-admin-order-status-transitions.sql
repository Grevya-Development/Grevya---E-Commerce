-- Admin order-status repair.
--
-- This file intentionally does not change supabase/functions.sql or
-- supabase/policies.sql. Run it in the Supabase SQL Editor after those files
-- have already created the base functions, triggers, and policies.
--
-- Goal:
-- 1. Admins can change an order to any status from the admin Orders page.
-- 2. Sellers keep the restricted seller flow.
-- 3. The canonical status column and legacy order_status column stay synced.

CREATE OR REPLACE FUNCTION public.enforce_seller_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_status text := lower(replace(coalesce(old.order_status, old.status, 'pending'), ' ', '_'));
  new_status text := lower(replace(coalesce(new.order_status, new.status, 'pending'), ' ', '_'));
BEGIN
  IF old_status = new_status THEN
    RETURN new;
  END IF;

  -- Admins have full fulfillment control from the admin Orders page.
  IF public.is_admin() THEN
    RETURN new;
  END IF;

  IF
    (old_status = 'pending' AND new_status IN ('confirmed', 'cancelled'))
    OR (old_status = 'confirmed' AND new_status IN ('processing', 'cancelled'))
    OR (old_status = 'processing' AND new_status IN ('shipped', 'cancelled'))
  THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION
    'Invalid seller order-status transition: % -> %',
    old_status,
    new_status;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_seller_order_status_transition_trigger ON public.orders;
CREATE TRIGGER enforce_seller_order_status_transition_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seller_order_status_transition();


CREATE OR REPLACE FUNCTION public.sync_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF new.total IS NOT NULL AND (new.total_amount IS NULL OR new.total_amount <> new.total) THEN
    new.total_amount := new.total;
  ELSIF new.total_amount IS NOT NULL AND (new.total IS NULL OR new.total <> new.total_amount) THEN
    new.total := new.total_amount;
  END IF;

  -- Keep status and order_status aligned. On updates, prefer the column that
  -- actually changed so the other column cannot overwrite it with stale data.
  IF TG_OP = 'UPDATE' THEN
    IF new.status IS DISTINCT FROM old.status THEN
      new.order_status := new.status;
    ELSIF new.order_status IS DISTINCT FROM old.order_status THEN
      new.status := new.order_status;
    ELSIF new.status IS NULL AND new.order_status IS NOT NULL THEN
      new.status := new.order_status;
    ELSIF new.order_status IS NULL AND new.status IS NOT NULL THEN
      new.order_status := new.status;
    END IF;
  ELSE
    IF new.status IS NOT NULL THEN
      new.order_status := new.status;
    ELSIF new.order_status IS NOT NULL THEN
      new.status := new.order_status;
    END IF;
  END IF;

  IF new.tracking_number IS NULL THEN
    new.tracking_number := 'TRK-' || upper(substring(md5(random()::text) FROM 1 FOR 12));
  END IF;

  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_order_totals ON public.orders;
CREATE TRIGGER trg_sync_order_totals
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_totals();


CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN new;
  END IF;

  IF old.status IS NOT DISTINCT FROM new.status THEN
    RETURN new;
  END IF;

  -- Admins have full fulfillment control from the admin Orders page.
  IF public.is_admin() THEN
    RETURN new;
  END IF;

  IF old.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot update a cancelled order';
  END IF;

  IF old.status = 'delivered' THEN
    RAISE EXCEPTION 'Cannot update a delivered order';
  END IF;

  IF (
    (old.status = 'pending' AND new.status IN ('confirmed', 'cancelled')) OR
    (old.status = 'confirmed' AND new.status IN ('processing', 'cancelled')) OR
    (old.status = 'processing' AND new.status IN ('shipped', 'cancelled')) OR
    (old.status = 'shipped' AND new.status = 'out_for_delivery') OR
    (old.status = 'out_for_delivery' AND new.status = 'delivered')
  ) THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'Invalid order-status transition: % -> %', old.status, new.status;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_order_status ON public.orders;
CREATE TRIGGER trg_validate_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();

DROP TRIGGER IF EXISTS validate_order_status_transition_trigger ON public.orders;
CREATE TRIGGER validate_order_status_transition_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();
