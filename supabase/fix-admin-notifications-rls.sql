-- Permit notification owners and authenticated admins to manage notifications.
-- `has_permission` is the project's existing SECURITY DEFINER authorization
-- helper; it resolves admin/super_admin from JWT metadata server-side.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications are user owned" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are selectable by owner" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are selectable by owner or admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are insertable by owner or admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are updatable by owner" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are updatable by owner or admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications are deletable by owner or admin" ON public.notifications;

CREATE POLICY "Notifications are selectable by owner or admin"
  ON public.notifications FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'audit:read')
  );

CREATE POLICY "Notifications are insertable by owner or admin"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'audit:read')
  );

CREATE POLICY "Notifications are updatable by owner or admin"
  ON public.notifications FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'audit:read')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'audit:read')
  );

CREATE POLICY "Notifications are deletable by owner or admin"
  ON public.notifications FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'audit:read')
  );
