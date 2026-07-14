-- Functions
CREATE OR REPLACE FUNCTION public.apply_signup_profile(profile_role text, profile_full_name text, profile_phone text, profile_avatar_url text)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized_role text := CASE
    WHEN profile_role = 'seller' THEN 'seller'
    ELSE 'customer'
  END;
  synced_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM set_config('app.allow_signup_role_update', 'true', true);

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    avatar_url,
    role
  )
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    profile_full_name,
    profile_phone,
    profile_avatar_url,
    normalized_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    role = CASE
      WHEN profiles.role = 'admin' THEN profiles.role
      ELSE normalized_role
    END,
    updated_at = now()
  WHERE profiles.id = auth.uid()
  RETURNING * INTO synced_profile;

  RETURN synced_profile;
END;
$function$

CREATE OR REPLACE FUNCTION public.can_access_order(target_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT EXISTS (
SELECT 1
FROM public.orders
WHERE id = target_order_id
AND (
user_id = auth.uid()
OR public.is_admin()
)
);
$function$

CREATE OR REPLACE FUNCTION public.can_access_order_via_product(target_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT
EXISTS (
SELECT 1
FROM public.orders o
WHERE o.id = target_order_id
AND (
o.user_id = auth.uid()
OR public.is_admin()
)
)
OR EXISTS (
SELECT 1
FROM public.order_items oi
JOIN public.products p
ON p.id = oi.product_id
WHERE oi.order_id = target_order_id
AND p.seller_id = auth.uid()
);
$function$

CREATE OR REPLACE FUNCTION public.get_admin_order_items(p_order_id uuid)
 RETURNS TABLE(id uuid, order_id uuid, product_id bigint, product_name text, product_image text, quantity integer, price numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) then
    raise exception 'Only admins can view admin order items';
  end if;

  return query
  select
    oi.id,
    oi.order_id,
    oi.product_id,
    oi.product_name,
    oi.product_image,
    oi.quantity,
    oi.price,
    oi.created_at
  from public.order_items oi
  where oi.order_id = p_order_id
  order by oi.created_at asc;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_seller_order_items()
 RETURNS TABLE(id uuid, order_id uuid, product_id uuid, product_name text, quantity integer, price numeric, created_at timestamp with time zone, order_status text, payment_status text, buyer_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT
oi.id,
oi.order_id,
oi.product_id,
p.name::text AS product_name,
oi.quantity,
oi.price,
oi.created_at,
o.order_status,
o.payment_status,
o.user_id AS buyer_id
FROM public.order_items oi
JOIN public.products p ON p.id = oi.product_id
JOIN public.orders o ON o.id = oi.order_id
WHERE p.seller_id = auth.uid()
ORDER BY oi.created_at DESC;
$function$

CREATE OR REPLACE FUNCTION public.get_seller_order_items_v2()
 RETURNS TABLE(id uuid, order_id uuid, product_id text, product_name text, product_image text, quantity integer, price numeric, created_at timestamp with time zone, order_status text, payment_status text, tracking_number text, estimated_delivery timestamp with time zone, user_id uuid, shipping_address jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    oi.id,
    oi.order_id,
    oi.product_id::text AS product_id,
    oi.product_name,
    oi.product_image,
    oi.quantity,
    oi.price,
    oi.created_at,
    o.status AS order_status,
    o.payment_status,
    o.tracking_number,
    o.estimated_delivery,
    o.user_id,
    o.shipping_address
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  JOIN public.orders o ON o.id = oi.order_id
  WHERE p.seller_id = auth.uid()
  ORDER BY oi.created_at DESC;
$function$

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$function$

CREATE OR REPLACE FUNCTION public.is_valid_order_status_transition(old_status text, new_status text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case lower(coalesce(old_status, 'pending'))
    when 'pending' then lower(new_status) in ('confirmed', 'cancelled')
    when 'confirmed' then lower(new_status) in ('processing', 'cancelled')
    when 'processing' then lower(new_status) = 'shipped'
    when 'shipped' then lower(new_status) = 'out_for_delivery'
    when 'out_for_delivery' then lower(new_status) = 'delivered'
    else false
  end;
$function$

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$

CREATE OR REPLACE FUNCTION public.seller_can_access_order(target_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT EXISTS (
SELECT 1
FROM public.order_items oi
JOIN public.products p
ON p.id = oi.product_id
WHERE oi.order_id = target_order_id
AND p.seller_id = auth.uid()
);
$function$

CREATE OR REPLACE FUNCTION public.seller_owns_order_item(target_product_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT EXISTS (
SELECT 1
FROM public.products
WHERE id = target_product_id
AND seller_id = auth.uid()
);
$function$

CREATE OR REPLACE FUNCTION public.update_seller_order_status(target_order_id uuid, next_status text)
 RETURNS TABLE(id uuid, order_status text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
IF next_status NOT IN (
'pending',
'confirmed',
'processing',
'shipped',
'out_for_delivery',
'delivered',
'cancelled'
) THEN
RAISE EXCEPTION 'Invalid order status: %', next_status;
END IF;

IF NOT public.seller_can_access_order(target_order_id) THEN
RAISE EXCEPTION 'You can only update orders containing your products.';
END IF;

RETURN QUERY
UPDATE public.orders o
SET
order_status = next_status,
updated_at = now()
WHERE o.id = target_order_id
RETURNING
o.id,
o.order_status,
o.updated_at;
END;
$function$

-- Trigger Functions
CREATE OR REPLACE FUNCTION public.enforce_seller_order_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  old_status text := lower(replace(coalesce(old.order_status, old.status, 'pending'), ' ', '_'));
  new_status text := lower(replace(coalesce(new.order_status, new.status, 'pending'), ' ', '_'));
begin
  if old_status = new_status then
    return new;
  end if;

  -- Admins have full fulfillment control from the admin Orders page.
  if public.is_admin() then
    return new;
  end if;

  if
    (old_status = 'pending' and new_status in ('confirmed', 'cancelled'))
    or (old_status = 'confirmed' and new_status in ('processing', 'cancelled'))
    or (old_status = 'processing' and new_status in ('shipped', 'cancelled'))
  then
    return new;
  end if;

  raise exception
    'Invalid seller order-status transition: % -> %',
    old_status,
    new_status;
end;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'phone',
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.log_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(old.order_status, old.status, 'pending')
     is distinct from
     coalesce(new.order_status, new.status, 'pending') then

    insert into public.order_status_history (
      order_id,
      status,
      note
    )
    values (
      new.id,
      coalesce(new.order_status, new.status, 'pending'),
      case
        when public.is_admin() then 'Status updated by admin'
        else 'Status updated by seller'
      end
    );
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.normalize_user_email_change_tokens()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
$function$

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  signup_role_update_allowed boolean :=
    current_setting('app.allow_signup_role_update', true) = 'true';
BEGIN
  -- Block public creation of admin profiles
  IF TG_OP = 'INSERT'
     AND NEW.role = 'admin'
     AND NOT public.is_admin()
  THEN
    RAISE EXCEPTION 'Admin profiles cannot be created through public signup';
  END IF;

  -- Restrict role and active-status changes for non-admin users
  IF TG_OP = 'UPDATE' AND NOT public.is_admin() THEN

    IF NEW.role IS DISTINCT FROM OLD.role
       AND NOT (
         signup_role_update_allowed
         AND OLD.role IS DISTINCT FROM 'admin'
         AND NEW.role IN ('customer', 'seller')
       )
    THEN
      RAISE EXCEPTION 'Profile role cannot be changed by this user';
    END IF;

    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Profile active status cannot be changed by this user';
    END IF;

  END IF;

  RETURN NEW;
END;
$function$

CREATE OR REPLACE FUNCTION public.sync_notification_read_flags()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.is_read is not null and (new.read is null or new.read <> new.is_read) then
    new.read := new.is_read;
  elsif new.read is not null and (new.is_read is null or new.is_read <> new.read) then
    new.is_read := new.read;
  end if;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.sync_order_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.total is not null and (new.total_amount is null or new.total_amount <> new.total) then
    new.total_amount := new.total;
  elsif new.total_amount is not null and (new.total is null or new.total <> new.total_amount) then
    new.total := new.total_amount;
  end if;

  -- Keep status and order_status aligned. On updates, prefer the column that
  -- actually changed so the other column cannot overwrite it with stale data.
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      new.order_status := new.status;
    elsif new.order_status is distinct from old.order_status then
      new.status := new.order_status;
    elsif new.status is null and new.order_status is not null then
      new.status := new.order_status;
    elsif new.order_status is null and new.status is not null then
      new.order_status := new.status;
    end if;
  else
    if new.status is not null then
      new.order_status := new.status;
    elsif new.order_status is not null then
      new.status := new.order_status;
    end if;
  end if;
  
  -- Automatically generate tracking number if missing
  if new.tracking_number is null then
    new.tracking_number := 'TRK-' || upper(substring(md5(random()::text) from 1 for 12));
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.sync_pincode_and_postal_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.postal_code is not null and (new.pincode is null or new.pincode <> new.postal_code) then
    new.pincode := new.postal_code;
  elsif new.pincode is not null and (new.postal_code is null or new.postal_code <> new.pincode) then
    new.postal_code := new.pincode;
  end if;
  
  -- Sync address_line1 and address_line_1
  if new.address_line_1 is not null and (new.address_line1 is null or new.address_line1 <> new.address_line_1) then
    new.address_line1 := new.address_line_1;
  elsif new.address_line1 is not null and (new.address_line_1 is null or new.address_line_1 <> new.address_line1) then
    new.address_line_1 := new.address_line1;
  end if;

  -- Sync address_line2 and address_line_2
  if new.address_line_2 is not null and (new.address_line2 is null or new.address_line2 <> new.address_line_2) then
    new.address_line2 := new.address_line_2;
  elsif new.address_line2 is not null and (new.address_line_2 is null or new.address_line_2 <> new.address_line2) then
    new.address_line_2 := new.address_line2;
  end if;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  is_admin boolean;
begin
  if tg_op = 'INSERT' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  select public.is_admin() into is_admin;

  if old.status = 'cancelled' then
    raise exception 'Cannot update a cancelled order';
  end if;

  if old.status = 'delivered' then
    raise exception 'Cannot update a delivered order';
  end if;

  -- Admin users can manage fulfillment from the admin Orders page.
  if is_admin then
    return new;
  end if;

  if (
    (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or
    (old.status = 'confirmed' and new.status in ('processing', 'cancelled')) or
    (old.status = 'processing' and new.status in ('shipped', 'cancelled')) or
    (old.status = 'shipped' and new.status = 'out_for_delivery') or
    (old.status = 'out_for_delivery' and new.status = 'delivered')
  ) then
    return new;
  end if;

  raise exception 'Invalid order-status transition: % -> %', old.status, new.status;
end;
$function$

-- Triggers
DROP TRIGGER IF EXISTS trg_sync_address_codes ON public.addresses;
CREATE TRIGGER trg_sync_address_codes
  BEFORE INSERT OR UPDATE ON public.addresses
  FOR EACH ROW
  EXECUTE FUNCTION sync_pincode_and_postal_code();

DROP TRIGGER IF EXISTS trg_sync_notification_read ON public.notifications;
CREATE TRIGGER trg_sync_notification_read
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION sync_notification_read_flags();

DROP TRIGGER IF EXISTS enforce_seller_order_status_transition_trigger ON public.orders;
CREATE TRIGGER enforce_seller_order_status_transition_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_seller_order_status_transition();

DROP TRIGGER IF EXISTS log_order_status_change_trigger ON public.orders;
CREATE TRIGGER log_order_status_change_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

DROP TRIGGER IF EXISTS trg_sync_order_totals ON public.orders;
CREATE TRIGGER trg_sync_order_totals
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_totals();

DROP TRIGGER IF EXISTS trg_validate_order_status ON public.orders;
CREATE TRIGGER trg_validate_order_status
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_status_transition();

DROP TRIGGER IF EXISTS validate_order_status_transition_trigger ON public.orders;
CREATE TRIGGER validate_order_status_transition_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_status_transition();

DROP TRIGGER IF EXISTS prevent_profile_role_escalation_trigger ON public.profiles;
CREATE TRIGGER prevent_profile_role_escalation_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_role_escalation();

-- Event Trigger
-- No event trigger definition was present in the provided exports.
