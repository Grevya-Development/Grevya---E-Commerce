-- ====================================================================
-- GREVYA E-COMMERCE PRODUCTION HARDENING SCHEMA MIGRATIONS
-- Run this in the Supabase SQL Editor.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. ORDER STATUS TRANSITION VALIDATION
-- Enforces chronological progression and blocks rollback or final state updates.
-- --------------------------------------------------------------------
create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Prevent any updates to orders that are already cancelled or delivered
  if old.status = 'cancelled' then
    raise exception 'Cannot update a cancelled order';
  end if;
  if old.status = 'delivered' then
    raise exception 'Cannot update a delivered order';
  end if;

  -- Allow direct cancellation from any non-final state
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Enforce standard progression flow. Prevents rolling back status.
  -- Steps: pending -> confirmed -> processing -> shipped -> out_for_delivery -> delivered
  if (
    (old.status = 'confirmed' and new.status = 'pending') or
    (old.status = 'processing' and new.status in ('pending', 'confirmed')) or
    (old.status = 'shipped' and new.status in ('pending', 'confirmed', 'processing')) or
    (old.status = 'out_for_delivery' and new.status in ('pending', 'confirmed', 'processing', 'shipped')) or
    (old.status = 'delivered' and new.status <> 'delivered')
  ) then
    raise exception 'Invalid status transition rollback from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_order_status on public.orders;
create trigger trg_validate_order_status
  before update of status on public.orders
  for each row execute procedure public.validate_order_status_transition();


-- --------------------------------------------------------------------
-- 2. ORDER STATUS HISTORY LOGGER & NOTIFICATION TRIGGER
-- Log historical state transitions and auto-notify the customer.
-- --------------------------------------------------------------------
create or replace function public.handle_order_status_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Validate changes and write log only when order status actually changes
  if old.status is null or old.status <> new.status then
    -- Insert timeline record into order status history if the table exists
    begin
      insert into public.order_status_history (order_id, status, notes)
      values (new.id, new.status, 'Order status updated to ' || new.status);
    exception when undefined_table then
      -- Fallback if table doesn't exist
      perform json_build_object('log', 'order_status_history table not found');
    end;

    -- Insert in-app notification row
    insert into public.notifications (user_id, message, type)
    values (
      new.user_id,
      'Your order #' || substring(new.id::text from 1 for 8) || ' status has been updated to ' || new.status || '.',
      'order'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_status_updated on public.orders;
create trigger on_order_status_updated
  after update of status on public.orders
  for each row execute procedure public.handle_order_status_update();


-- --------------------------------------------------------------------
-- 3. RLS AUDIT & SECURITY AUDIT FOR HARDENED TABLES
-- --------------------------------------------------------------------

-- Profile creation & update sync triggers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do update set 
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name),
    phone = coalesce(excluded.phone, profiles.phone);
  return new;
end;
$$;

-- order_status_history Row Level Security (if table exists)
alter table public.order_status_history enable row level security;
drop policy if exists "Users read owned status history" on public.order_status_history;
create policy "Users read owned status history" on public.order_status_history 
  for select using (
    exists (
      select 1 from public.orders 
      where orders.id = order_status_history.order_id 
        and orders.user_id = auth.uid()
    )
  );

-- reviews Row Level Security (public read, authenticated user write own review)
alter table public.reviews enable row level security;
drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are publicly readable" on public.reviews 
  for select using (true);

drop policy if exists "Authenticated users can insert reviews" on public.reviews;
create policy "Authenticated users can insert reviews" on public.reviews 
  for insert to authenticated 
  with check (auth.uid() = user_id);


-- --------------------------------------------------------------------
-- 4. SECURE AVATARS STORAGE BUCKET POLICIES
-- --------------------------------------------------------------------
-- Allow public reading, but restrict modifications to the user's subfolder path.
drop policy if exists "Avatar uploads are user owned" on storage.objects;
create policy "Avatar uploads are user owned" on storage.objects 
  for insert with check (
    bucket_id = 'avatars' 
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatar updates are user owned" on storage.objects;
create policy "Avatar updates are user owned" on storage.objects 
  for update using (
    bucket_id = 'avatars' 
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable" on storage.objects 
  for select using (bucket_id = 'avatars');

drop policy if exists "Avatar deletes are user owned" on storage.objects;
create policy "Avatar deletes are user owned" on storage.objects 
  for delete using (
    bucket_id = 'avatars' 
    and (auth.uid())::text = (storage.foldername(name))[1]
  );


-- --------------------------------------------------------------------
-- 5. AUTH USERS EMAIL CHANGE TOKENS NULL-NORMALIZATION
-- Prevents GoTrue daemon from crashing due to NULL values in token fields.
-- --------------------------------------------------------------------
create or replace function public.normalize_user_email_change_tokens()
returns trigger
language plpgsql
security definer
as $$
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
$$;

drop trigger if exists trg_normalize_user_email_change_tokens on auth.users;
create trigger trg_normalize_user_email_change_tokens
  before insert or update on auth.users
  for each row execute procedure public.normalize_user_email_change_tokens();

-- Direct repair query to clean up any existing rows during migration:
update auth.users
set email_change = coalesce(email_change, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, '')
where email_change is null or email_change_token_new is null or email_change_token_current is null;


