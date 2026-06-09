-- Grevya Supabase schema. Run in Supabase SQL editor, then configure Auth providers and Storage.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  avatar_url text,
  phone text,
  email text,
  preferences jsonb default '{"marketing":true,"order_updates":true}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text default 'Home',
  full_name text not null,
  phone text not null,
  address_line1 text not null,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text unique,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  payment_method text,
  payment_reference jsonb,
  shipping_address jsonb,
  estimated_delivery timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint,
  product_name text,
  product_image text,
  quantity integer not null check (quantity > 0),
  price numeric(12,2) not null,
  created_at timestamptz default now()
);

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

create table if not exists public.product_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  product_id bigint not null,
  interaction_type text not null,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  message text not null,
  type text default 'info',
  read boolean default false,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.carts enable row level security;
alter table public.product_interactions enable row level security;
alter table public.notifications enable row level security;

create policy "Profiles are user owned" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Addresses are user owned" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Orders are user owned" on public.orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users read owned order items" on public.order_items for select using (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));
create policy "Users insert owned order items" on public.order_items for insert with check (exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid()));
create policy "Wishlists are user owned" on public.wishlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Carts are user owned" on public.carts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users create interactions" on public.product_interactions for insert with check (auth.uid() = user_id or user_id is null);
create policy "Notifications are user owned" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
