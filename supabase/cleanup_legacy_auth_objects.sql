-- Safe cleanup script for any legacy Clerk-era objects left in the Supabase project.
-- Review and run this manually in the Supabase SQL Editor only if your live database still contains old artifacts.

BEGIN;

DO $$
DECLARE
  has_clerk_col BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'clerk_user_id'
  ) INTO has_clerk_col;

  IF has_clerk_col THEN
    ALTER TABLE public.profiles DROP COLUMN IF EXISTS clerk_user_id;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.clerk_user_id() CASCADE;
DROP FUNCTION IF EXISTS public.auth_user_id() CASCADE;
DROP FUNCTION IF EXISTS public.current_profile_id() CASCADE;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_profile_role_escalation() CASCADE;

DROP POLICY IF EXISTS "Allow Clerk to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow Clerk to update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow Clerk to delete profiles" ON public.profiles;

DROP INDEX IF EXISTS public.profiles_clerk_user_id_key;
DROP INDEX IF EXISTS public.profiles_clerk_user_id_idx;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_clerk_user_id_key;

COMMIT;
