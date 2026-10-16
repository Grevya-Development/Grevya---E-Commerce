CREATE TABLE IF NOT EXISTS public.order_shipped_email_deliveries (
  order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status TEXT NOT NULL,
  shipped_at TIMESTAMPTZ NOT NULL,
  order_snapshot JSONB NOT NULL,
  order_items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery_snapshot JSONB,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sending', 'sent', 'failed')),
  resend_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_shipped_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_shipped_email_deliveries
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.order_shipped_email_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.capture_order_shipped_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_items JSONB;
  v_delivery JSONB;
BEGIN
  IF LOWER(BTRIM(COALESCE(OLD.status, ''))) = 'shipped'
    OR LOWER(BTRIM(COALESCE(NEW.status, ''))) <> 'shipped'
  THEN
    RETURN NEW;
  END IF;

  RAISE LOG '[ORDER EMAIL] Shipped transition detected for order %', NEW.id;

  BEGIN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_name', item.product_name,
          'quantity', item.quantity,
          'price', item.price
        )
        ORDER BY item.created_at
      ),
      '[]'::jsonb
    )
    INTO v_items
    FROM public.order_items AS item
    WHERE item.order_id = NEW.id;

    IF (
      SELECT count(*) = 5
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'deliveries'
        AND column_name IN (
          'order_id',
          'shipped_at',
          'tracking_number',
          'tracking_url',
          'estimated_delivery_at'
        )
    ) THEN
      EXECUTE
        'SELECT jsonb_build_object(
           ''tracking_number'', delivery.tracking_number,
           ''tracking_url'', delivery.tracking_url,
           ''estimated_delivery_at'', delivery.estimated_delivery_at
         )
         FROM public.deliveries AS delivery
         WHERE delivery.order_id = $1
         ORDER BY delivery.shipped_at DESC NULLS LAST
         LIMIT 1'
      INTO v_delivery
      USING NEW.id;
    END IF;

    INSERT INTO public.order_shipped_email_deliveries (
      order_id,
      user_id,
      changed_by,
      previous_status,
      shipped_at,
      order_snapshot,
      order_items_snapshot,
      delivery_snapshot
    )
    VALUES (
      NEW.id,
      NEW.user_id,
      auth.uid(),
      OLD.status,
      clock_timestamp(),
      jsonb_build_object(
        'id', NEW.id,
        'order_number', NEW.order_number,
        'created_at', NEW.created_at,
        'subtotal', to_jsonb(NEW) -> 'subtotal',
        'shipping', to_jsonb(NEW) -> 'shipping',
        'discount', to_jsonb(NEW) -> 'discount',
        'total_amount', to_jsonb(NEW) -> 'total_amount',
        'shipping_address', to_jsonb(NEW) -> 'shipping_address',
        'payment_method', to_jsonb(NEW) -> 'payment_method',
        'payment_status', to_jsonb(NEW) -> 'payment_status',
        'tracking_number', to_jsonb(NEW) -> 'tracking_number',
        'estimated_delivery', to_jsonb(NEW) -> 'estimated_delivery'
      ),
      v_items,
      v_delivery
    )
    ON CONFLICT (order_id) DO NOTHING;
    RAISE LOG '[ORDER EMAIL] Transition event recorded for order %', NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[ORDER EMAIL] Could not record transition event for order %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_order_shipped_email
  ON public.orders;
CREATE TRIGGER capture_order_shipped_email
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (
    LOWER(BTRIM(COALESCE(OLD.status, ''))) <> 'shipped'
    AND LOWER(BTRIM(COALESCE(NEW.status, ''))) = 'shipped'
  )
  EXECUTE FUNCTION public.capture_order_shipped_email();

CREATE OR REPLACE FUNCTION public.claim_order_shipped_email(
  p_order_id UUID,
  p_changed_by UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claimed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;

  UPDATE public.order_shipped_email_deliveries
  SET
    delivery_status = 'sending',
    updated_at = now()
  WHERE order_id = p_order_id
    AND changed_by = p_changed_by
    AND delivery_status = 'pending'
  RETURNING order_id INTO v_claimed;

  RETURN v_claimed IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_order_shipped_email(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_shipped_email(UUID, UUID)
  TO service_role;
