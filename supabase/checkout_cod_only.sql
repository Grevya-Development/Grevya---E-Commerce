-- Keep order inserts aligned with the checkout methods currently available.
-- This is restrictive so it also applies alongside existing permissive RLS
-- policies, while leaving read and update policies unchanged.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Checkout orders use COD only" ON public.orders;
CREATE POLICY "Checkout orders use COD only"
  ON public.orders
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (LOWER(BTRIM(COALESCE(payment_method, ''))) = 'cod');
