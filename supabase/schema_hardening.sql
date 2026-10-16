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
declare
  product_names text;
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
create or replace function public.deduct_order_stock_on_confirmation(
  p_order_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_product record;
  v_variant record;
  v_inventory record;
  v_stock bigint;
  v_available bigint;
  v_remaining bigint;
  v_take bigint;
  v_inventory_rows integer;
  v_row_count bigint;
  v_variant_count bigint;
  v_variant_product_id bigint;
  v_product_stock_exists boolean;
  v_inventory_exists boolean;
  v_variants_exist boolean;
  v_variant_stock_column text;
  v_product_id_expression text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'stock'
  ) into v_product_stock_exists;
  v_inventory_exists := to_regclass('public.inventory') is not null;
  v_variants_exist := to_regclass('public.product_variants') is not null;
  v_product_id_expression := 'nullif(to_jsonb(oi)->>''product_id'', '''')::bigint';
  if v_variants_exist then
    v_product_id_expression :=
      'coalesce(' || v_product_id_expression ||
      ', (select (to_jsonb(pv)->>''product_id'')::bigint
          from public.product_variants pv
          where pv.id = nullif(to_jsonb(oi)->>''variant_id'', '''')::uuid))';
  end if;

  select column_name
  into v_variant_stock_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'product_variants'
    and column_name in ('stock', 'inventory', 'quantity')
  order by case column_name
    when 'stock' then 1
    when 'inventory' then 2
    else 3
  end
  limit 1;

  -- Lock products in a stable order, then validate every line before changing stock.
  for v_product in execute format(
    'select %s as product_id, sum(oi.quantity)::bigint as quantity
     from public.order_items oi
     where oi.order_id = $1
     group by 1
     order by 1',
    v_product_id_expression
  ) using p_order_id
  loop
    if v_product.product_id is null then
      raise exception 'Order % contains an item without a product ID', p_order_id;
    end if;

    select nullif(to_jsonb(p)->>'stock', '')::bigint
    into v_stock
    from public.products p
    where p.id = v_product.product_id
    for update;

    if not found then
      raise exception 'Product % for order % was not found', v_product.product_id, p_order_id;
    end if;

    if v_product_stock_exists then
      if v_stock is null then
        raise exception 'Stock is not configured for product %', v_product.product_id;
      end if;
      if v_stock < v_product.quantity then
        raise exception 'Insufficient stock for product %: requested %, available %',
          v_product.product_id, v_product.quantity, v_stock;
      end if;
    end if;
  end loop;

  if not v_product_stock_exists and exists (
    select 1
    from public.order_items oi
    where oi.order_id = p_order_id
      and nullif(to_jsonb(oi)->>'variant_id', '') is null
  ) then
    raise exception 'Product stock is not configured; order % cannot be confirmed', p_order_id;
  end if;

  -- Variant inventory is optional for legacy products. When present, reserve-aware
  -- availability is checked and each warehouse row is locked before any deduction.
  for v_variant in execute format(
    'select
       %s as product_id,
       nullif(to_jsonb(oi)->>''variant_id'', '''')::uuid as variant_id,
       sum(oi.quantity)::bigint as quantity
     from public.order_items oi
     where oi.order_id = $1
       and nullif(to_jsonb(oi)->>''variant_id'', '''') is not null
     group by 1, 2
     order by 2',
    v_product_id_expression
  ) using p_order_id
  loop
    if v_variants_exist then
      execute
        'select (to_jsonb(pv)->>''product_id'')::bigint
         from public.product_variants pv
         where pv.id = $1
         for update'
      into v_variant_product_id
      using v_variant.variant_id;
      get diagnostics v_row_count = row_count;

      if v_row_count = 0 then
        raise exception 'Variant % for order % was not found',
          v_variant.variant_id, p_order_id;
      end if;
      if v_variant_product_id is distinct from v_variant.product_id then
        raise exception 'Variant % does not belong to product %',
          v_variant.variant_id, v_variant.product_id;
      end if;
    end if;

    v_available := 0;
    v_inventory_rows := 0;

    if v_inventory_exists then
      for v_inventory in
        select id, quantity_on_hand, quantity_reserved
        from public.inventory
        where variant_id = v_variant.variant_id
        order by warehouse_id, id
        for update
      loop
        v_inventory_rows := v_inventory_rows + 1;
        v_available := v_available
          + v_inventory.quantity_on_hand
          - v_inventory.quantity_reserved;
      end loop;
    end if;

    if v_inventory_rows > 0 then
      if v_available < v_variant.quantity then
        raise exception 'Insufficient stock for variant %: requested %, available %',
          v_variant.variant_id, v_variant.quantity, v_available;
      end if;
    elsif v_variant_stock_column is not null and v_variants_exist then
      execute format(
        'select nullif(to_jsonb(pv)->>%L, '''')::bigint
         from public.product_variants pv
         where pv.id = $1
         for update',
        v_variant_stock_column
      )
      into v_stock
      using v_variant.variant_id;

      get diagnostics v_row_count = row_count;
      if v_row_count = 0 then
        raise exception 'Variant % for order % was not found',
          v_variant.variant_id, p_order_id;
      end if;
      if v_stock is null or v_stock < v_variant.quantity then
        raise exception 'Insufficient stock for variant %: requested %, available %',
          v_variant.variant_id, v_variant.quantity, coalesce(v_stock, 0);
      end if;
    elsif v_product_stock_exists and v_variants_exist then
      execute
        'select count(*)
         from public.product_variants pv
         where pv.product_id = $1
           and coalesce((to_jsonb(pv)->>''is_active'')::boolean, true)'
      into v_variant_count
      using v_variant.product_id;

      if v_variant_count <> 1 then
        raise exception 'Inventory is not configured for variant %',
          v_variant.variant_id;
      end if;
    else
      raise exception 'Inventory is not configured for variant %',
        v_variant.variant_id;
    end if;
  end loop;

  -- All required stock is now locked and validated; apply the deductions.
  if v_product_stock_exists then
    for v_product in execute format(
      'select %s as product_id, sum(oi.quantity)::bigint as quantity
       from public.order_items oi
       where oi.order_id = $1
       group by 1
       order by 1',
      v_product_id_expression
    ) using p_order_id
    loop
      execute
        'update public.products
         set stock = stock - $1
         where id = $2'
      using v_product.quantity, v_product.product_id;
    end loop;
  end if;

  for v_variant in execute format(
    'select
       %s as product_id,
       nullif(to_jsonb(oi)->>''variant_id'', '''')::uuid as variant_id,
       sum(oi.quantity)::bigint as quantity
     from public.order_items oi
     where oi.order_id = $1
       and nullif(to_jsonb(oi)->>''variant_id'', '''') is not null
     group by 1, 2
     order by 2',
    v_product_id_expression
  ) using p_order_id
  loop
    v_inventory_rows := 0;
    if v_inventory_exists then
      select count(*)::integer
      into v_inventory_rows
      from public.inventory
      where variant_id = v_variant.variant_id;
    end if;

    if v_inventory_rows > 0 then
      v_remaining := v_variant.quantity;
      for v_inventory in
        select id, quantity_on_hand, quantity_reserved
        from public.inventory
        where variant_id = v_variant.variant_id
        order by warehouse_id, id
        for update
      loop
        v_take := least(
          v_remaining,
          v_inventory.quantity_on_hand - v_inventory.quantity_reserved
        );
        if v_take > 0 then
          update public.inventory
          set quantity_on_hand = quantity_on_hand - v_take,
              updated_at = now(),
              version = version + 1
          where id = v_inventory.id;
          v_remaining := v_remaining - v_take;
        end if;
        exit when v_remaining = 0;
      end loop;
    elsif v_variant_stock_column is not null and v_variants_exist then
      execute format(
        'update public.product_variants
         set %I = %I - $1
         where id = $2',
        v_variant_stock_column,
        v_variant_stock_column
      )
      using v_variant.quantity, v_variant.variant_id;
    end if;
  end loop;
end;
$$;

revoke all on function public.deduct_order_stock_on_confirmation(uuid) from public;
revoke all on function public.deduct_order_stock_on_confirmation(uuid) from anon, authenticated;

create or replace function public.handle_order_status_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  product_names text;
begin
  -- Validate changes and write log only when order status actually changes
  if old.status is null or old.status <> new.status then
    if old.status = 'pending' and new.status = 'confirmed' then
      perform public.deduct_order_stock_on_confirmation(new.id);
    end if;

    -- The status RPC writes a richer history record after this trigger runs.
    if current_setting('app.order_status_history_logged_by_rpc', true) is distinct from 'true' then
      begin
        insert into public.order_status_history (order_id, status, notes)
        values (new.id, new.status, 'Order status updated to ' || new.status);
      exception when undefined_table then
        -- Fallback if table doesn't exist
        perform json_build_object('log', 'order_status_history table not found');
      end;
    end if;

    select string_agg(nullif(trim(product_name), ''), ', ' order by created_at)
      into product_names
      from public.order_items
      where order_id = new.id;

    -- Insert in-app notification row
    insert into public.notifications (user_id, message, type)
    values (
      new.user_id,
      'Your order for ' || coalesce(product_names, 'your items') || ' status has been updated to ' || new.status || '.',
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
