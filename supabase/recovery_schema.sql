-- ====================================================================
-- GREVYA E-COMMERCE DATABASE RECOVERY & SECURE RLS POLICIES (DB ONLY)
-- Run this script in the Supabase SQL Editor to align all schemas.
-- ====================================================================

-- --------------------------------------------------------------------
-- 0. TABLE DEFINITIONS ENSUREMENT (IF MISSING)
-- --------------------------------------------------------------------
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null,
  created_at timestamptz default now(),
  unique(user_id, product_id)
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, product_id)
);

-- --------------------------------------------------------------------
-- 1. PROFILES TABLE CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.profiles 
  add column if not exists username text,
  add column if not exists role text default 'customer',
  add column if not exists preferences jsonb default '{"marketing":true,"order_updates":true}'::jsonb,
  add column if not exists avatar_url text,
  add column if not exists phone text;

-- Add unique constraint to username field safely
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conrelid = 'public.profiles'::regclass and conname = 'profiles_username_key'
  ) then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end;
$$;

-- --------------------------------------------------------------------
-- 2. ADDRESSES TABLE CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.addresses 
  add column if not exists label text default 'Home',
  add column if not exists landmark text,
  add column if not exists address_line1 text,
  add column if not exists address_line_1 text,
  add column if not exists address_line2 text,
  add column if not exists address_line_2 text,
  add column if not exists country text default 'India',
  add column if not exists postal_code text,
  add column if not exists pincode text,
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
$$;

drop trigger if exists trg_sync_address_codes on public.addresses;
create trigger trg_sync_address_codes
  before insert or update on public.addresses
  for each row execute procedure public.sync_pincode_and_postal_code();

-- --------------------------------------------------------------------
-- 3. ORDERS TABLE CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.orders 
  add column if not exists order_number text,
  add column if not exists status text default 'pending',
  add column if not exists order_status text default 'pending',
  add column if not exists payment_method text,
  add column if not exists payment_reference jsonb,
  add column if not exists shipping_address jsonb,
  add column if not exists estimated_delivery timestamptz,
  add column if not exists tracking_number text,
  add column if not exists timeline jsonb default '[]'::jsonb,
  add column if not exists status_history jsonb default '[]'::jsonb,
  add column if not exists subtotal numeric(12,2) default 0.00,
  add column if not exists tax numeric(12,2) default 0.00,
  add column if not exists shipping numeric(12,2) default 0.00,
  add column if not exists total numeric(12,2) default 0.00,
  add column if not exists total_amount numeric(12,2) default 0.00;

-- Sync logic: ensure total, total_amount, status, and order_status remain identical
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

  -- Sync status and order_status
  if new.order_status is not null and (new.status is null or new.status <> new.order_status) then
    new.status := new.order_status;
  elsif new.status is not null and (new.order_status is null or new.order_status <> new.status) then
    new.order_status := new.status;
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
-- 4. ORDER ITEMS CODES & COLUMNS RECOVERY
-- --------------------------------------------------------------------
alter table public.order_items
  add column if not exists product_name text,
  add column if not exists product_image text;

-- --------------------------------------------------------------------
-- 5. NOTIFICATIONS TABLE CODES & COLUMNS RECOVERY
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
-- 6. SECURE TABLE LEVEL ROW LEVEL SECURITY (RLS) POLICIES
-- --------------------------------------------------------------------

-- 6.1 PROFILES TABLE POLICIES
alter table public.profiles enable row level security;

drop policy if exists "Profiles are user owned" on public.profiles;
drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can select own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 6.2 ADDRESSES TABLE POLICIES
alter table public.addresses enable row level security;

drop policy if exists "Addresses are user owned" on public.addresses;
drop policy if exists "Users can select own addresses" on public.addresses;
drop policy if exists "Users can insert own addresses" on public.addresses;
drop policy if exists "Users can update own addresses" on public.addresses;
drop policy if exists "Users can delete own addresses" on public.addresses;

create policy "Users can select own addresses" on public.addresses
  for select using (auth.uid() = user_id);

create policy "Users can insert own addresses" on public.addresses
  for insert with check (auth.uid() = user_id);

create policy "Users can update own addresses" on public.addresses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own addresses" on public.addresses
  for delete using (auth.uid() = user_id);

-- 6.3 ORDERS TABLE POLICIES
alter table public.orders enable row level security;

drop policy if exists "Orders are user owned" on public.orders;
drop policy if exists "Users can select own orders" on public.orders;
drop policy if exists "Users can insert own orders" on public.orders;
drop policy if exists "Users can update own orders" on public.orders;

create policy "Users can select own orders" on public.orders
  for select using (auth.uid() = user_id);

create policy "Users can insert own orders" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "Users can update own orders" on public.orders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6.4 ORDER_ITEMS TABLE POLICIES
alter table public.order_items enable row level security;

drop policy if exists "Users read owned order items" on public.order_items;
drop policy if exists "Users insert owned order items" on public.order_items;
drop policy if exists "Users can select owned order items" on public.order_items;
drop policy if exists "Users can insert owned order items" on public.order_items;

create policy "Users can select owned order items" on public.order_items
  for select using (
    exists (
      select 1 from public.orders 
      where orders.id = order_items.order_id 
        and orders.user_id = auth.uid()
    )
  );

create policy "Users can insert owned order items" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders 
      where orders.id = order_items.order_id 
        and orders.user_id = auth.uid()
    )
  );

-- 6.5 NOTIFICATIONS TABLE POLICIES
alter table public.notifications enable row level security;

drop policy if exists "Notifications are user owned" on public.notifications;
drop policy if exists "Users can select own notifications" on public.notifications;
drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;

create policy "Users can select own notifications" on public.notifications
  for select using (auth.uid() = user_id);

create policy "Users can insert own notifications" on public.notifications
  for insert with check (auth.uid() = user_id);

create policy "Users can update own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6.6 WISHLISTS TABLE POLICIES
alter table public.wishlists enable row level security;

drop policy if exists "Wishlists are user owned" on public.wishlists;
drop policy if exists "Users can select own wishlist" on public.wishlists;
drop policy if exists "Users can insert own wishlist" on public.wishlists;
drop policy if exists "Users can delete own wishlist" on public.wishlists;

create policy "Users can select own wishlist" on public.wishlists
  for select using (auth.uid() = user_id);

create policy "Users can insert own wishlist" on public.wishlists
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own wishlist" on public.wishlists
  for delete using (auth.uid() = user_id);

-- 6.7 CARTS TABLE POLICIES
alter table public.carts enable row level security;

drop policy if exists "Carts are user owned" on public.carts;
drop policy if exists "Users can select own cart" on public.carts;
drop policy if exists "Users can insert own cart" on public.carts;
drop policy if exists "Users can update own cart" on public.carts;
drop policy if exists "Users can delete own cart" on public.carts;

create policy "Users can select own cart" on public.carts
  for select using (auth.uid() = user_id);

create policy "Users can insert own cart" on public.carts
  for insert with check (auth.uid() = user_id);

create policy "Users can update own cart" on public.carts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete own cart" on public.carts
  for delete using (auth.uid() = user_id);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
