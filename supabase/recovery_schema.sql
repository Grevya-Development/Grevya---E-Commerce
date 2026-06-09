-- ====================================================================
-- GREVYA E-COMMERCE DATABASE RECOVERY & STORAGE BUCKET MIGRATION
-- Run this script in the Supabase SQL Editor to recover from mismatches.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. PROFILES TABLE CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.profiles 
  add column if not exists role text default 'customer',
  add column if not exists preferences jsonb default '{"marketing":true,"order_updates":true}'::jsonb,
  add column if not exists avatar_url text,
  add column if not exists phone text;

-- --------------------------------------------------------------------
-- 2. ADDRESSES TABLE CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.addresses 
  add column if not exists address_line2 text,
  add column if not exists country text default 'India',
  add column if not exists postal_code text,
  add column if not exists pincode text,
  add column if not exists landmark text,
  add column if not exists is_default boolean default false,
  add column if not exists updated_at timestamptz default now();

-- Sync logic: ensure pincode and postal_code remain identical if one is set
create or replace function public.sync_pincode_and_postal_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.postal_code is not null and (new.pincode is null or new.pincode <> new.postal_code) then
    new.pincode := new.postal_code;
  elsif new.pincode is not null and (new.postal_code is null or new.postal_code <> new.pincode) then
    new.postal_code := new.pincode;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_address_codes on public.addresses;
create trigger trg_sync_address_codes
  before insert or update on public.addresses
  for each row execute procedure public.sync_pincode_and_postal_code();

-- --------------------------------------------------------------------
-- 3. ORDERS TABLE CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.orders 
  add column if not exists estimated_delivery timestamptz,
  add column if not exists tracking_number text,
  add column if not exists timeline jsonb default '[]'::jsonb,
  add column if not exists status_history jsonb default '[]'::jsonb,
  add column if not exists subtotal numeric(12,2) default 0.00,
  add column if not exists tax numeric(12,2) default 0.00,
  add column if not exists shipping numeric(12,2) default 0.00,
  add column if not exists total numeric(12,2) default 0.00,
  add column if not exists total_amount numeric(12,2) default 0.00;

-- Sync logic: ensure total and total_amount remain identical
create or replace function public.sync_order_totals()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.total is not null and (new.total_amount is null or new.total_amount <> new.total) then
    new.total_amount := new.total;
  elsif new.total_amount is not null and (new.total is null or new.total <> new.total_amount) then
    new.total := new.total_amount;
  end if;
  
  -- Automatically generate tracking number if missing
  if new.tracking_number is null then
    new.tracking_number := 'TRK-' || upper(substring(md5(random()::text) from 1 for 12));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_order_totals on public.orders;
create trigger trg_sync_order_totals
  before insert or update on public.orders
  for each row execute procedure public.sync_order_totals();

-- --------------------------------------------------------------------
-- 4. NOTIFICATIONS TABLE CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.notifications 
  add column if not exists title text default 'Notification',
  add column if not exists is_read boolean default false,
  add column if not exists read boolean default false,
  add column if not exists metadata jsonb default '{}'::jsonb;

-- Sync logic: ensure read and is_read remain identical
create or replace function public.sync_notification_read_flags()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_read is not null and (new.read is null or new.read <> new.is_read) then
    new.read := new.is_read;
  elsif new.read is not null and (new.is_read is null or new.is_read <> new.read) then
    new.is_read := new.read;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_notification_read on public.notifications;
create trigger trg_sync_notification_read
  before insert or update on public.notifications
  for each row execute procedure public.sync_notification_read_flags();

-- --------------------------------------------------------------------
-- 5. STORAGE BUCKETS & POLICIES CREATION
-- --------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values 
  ('profile-images', 'profile-images', true),
  ('product-images', 'product-images', true),
  ('category-images', 'category-images', true),
  ('notification-assets', 'notification-assets', true)
on conflict (id) do nothing;

-- Enable RLS for newly created storage object policies
alter table storage.objects enable row level security;

-- 5.1 profile-images bucket policies
drop policy if exists "Profile images public read" on storage.objects;
create policy "Profile images public read" on storage.objects 
  for select using (bucket_id = 'profile-images');

drop policy if exists "Profile images insert by owner" on storage.objects;
create policy "Profile images insert by owner" on storage.objects 
  for insert with check (
    bucket_id = 'profile-images' 
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Profile images update by owner" on storage.objects;
create policy "Profile images update by owner" on storage.objects 
  for update using (
    bucket_id = 'profile-images' 
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "Profile images delete by owner" on storage.objects;
create policy "Profile images delete by owner" on storage.objects 
  for delete using (
    bucket_id = 'profile-images' 
    and (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 5.2 product-images bucket policies (Read for all, Insert/Update/Delete by admins)
drop policy if exists "Product images public read" on storage.objects;
create policy "Product images public read" on storage.objects 
  for select using (bucket_id = 'product-images');

drop policy if exists "Product images edit by admin" on storage.objects;
create policy "Product images edit by admin" on storage.objects 
  for all to authenticated using (
    bucket_id = 'product-images' 
    and exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 5.3 category-images bucket policies (Read for all, Insert/Update/Delete by admins)
drop policy if exists "Category images public read" on storage.objects;
create policy "Category images public read" on storage.objects 
  for select using (bucket_id = 'category-images');

drop policy if exists "Category images edit by admin" on storage.objects;
create policy "Category images edit by admin" on storage.objects 
  for all to authenticated using (
    bucket_id = 'category-images' 
    and exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 5.4 notification-assets bucket policies (Read for all, Insert/Update/Delete by admins)
drop policy if exists "Notification assets public read" on storage.objects;
create policy "Notification assets public read" on storage.objects 
  for select using (bucket_id = 'notification-assets');

drop policy if exists "Notification assets edit by admin" on storage.objects;
create policy "Notification assets edit by admin" on storage.objects 
  for all to authenticated using (
    bucket_id = 'notification-assets' 
    and exists (
      select 1 from public.profiles 
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
