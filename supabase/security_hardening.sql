-- ====================================================================
-- GREVYA E-COMMERCE PRODUCTION HARDENING SCHEMA MIGRATIONS
-- ====================================================================

-- 1. Redefine normalize_user_email_change_tokens with secure search_path
CREATE OR REPLACE FUNCTION public.normalize_user_email_change_tokens()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if new.email_change_token_new is null then
    new.email_change_token_new := '';
  end if;
  if new.email_change_token_current is null then
    new.email_change_token_current := '';
  end if;
  if new.email_change is null then
    new.email_change := '';
  end if;
  return new;
end;
$function$;

-- 2. Revoke execute privileges on definer functions from public, anon, and authenticated roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_user_email_change_tokens() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_notification_read_flags() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_order_totals() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_pincode_and_postal_code() FROM public, anon, authenticated;

-- 3. Reviews Table RLS Hardening
ALTER TABLE public.reviews ALTER COLUMN user_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Allow insert for all" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;

CREATE POLICY "Authenticated users can insert reviews" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 4. Storage Bucket Policy Hardening (Allow direct select/render, prevent listing)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Public read profile-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;

CREATE POLICY "Public read profile-images" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'profile-images'
    AND NOT storage.allow_only_operation('object.list')
  );

CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'avatars'
    AND NOT storage.allow_only_operation('object.list')
  );
