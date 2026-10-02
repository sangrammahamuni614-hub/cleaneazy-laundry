-- CleanEazy Laundry application access hardening.
-- This migration layers onto the existing live project schema and preserves business records.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Keep the one-time plan registration charge alongside each subscription.
alter table public.subscriptions
  add column if not exists registration_fee numeric(10,2) not null default 0
  check (registration_fee >= 0);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.staff_users s
    where s.user_id = (select auth.uid())
      and s.active = true
      and s.role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- The project's first Auth user predates its profile trigger. Bootstrap only when no staff row exists.
insert into public.staff_users (user_id, display_name, role, active)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'full_name',''), split_part(coalesce(u.email,''),'@',1)),
       'admin',
       true
from auth.users u
where not exists (select 1 from public.staff_users)
order by u.created_at asc
limit 1
on conflict (user_id) do nothing;

-- New accounts must arrive through Supabase Auth invitation. A browser sign-up cannot create staff access.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invited_at is null then
    raise exception 'CleanEazy accounts are invitation-only';
  end if;

  insert into public.staff_users (user_id, display_name, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), split_part(coalesce(new.email,''),'@',1)),
    'staff',
    true
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

-- A user's own profile is visible, but only an administrator can change another user's role/access.
grant select on public.staff_users to authenticated;
grant update (display_name, role, active) on public.staff_users to authenticated;
revoke insert, delete on public.staff_users from anon, authenticated;
drop policy if exists "staff can view own profile" on public.staff_users;
drop policy if exists "staff can update own display name" on public.staff_users;
drop policy if exists "staff can view all profiles" on public.staff_users;
drop policy if exists "CleanEazy staff can view own profile" on public.staff_users;
drop policy if exists "CleanEazy admins can view team" on public.staff_users;
drop policy if exists "CleanEazy admins can manage team" on public.staff_users;
create policy "CleanEazy staff can view own profile"
  on public.staff_users for select to authenticated
  using (user_id = (select auth.uid()));
create policy "CleanEazy admins can view team"
  on public.staff_users for select to authenticated
  using ((select private.is_admin()));
create policy "CleanEazy admins can manage team"
  on public.staff_users for update to authenticated
  using ((select private.is_admin()) and user_id <> (select auth.uid()))
  with check ((select private.is_admin()) and user_id <> (select auth.uid()));

-- The public data API needs explicit grants on business tables. RLS remains the row-level gate.
grant select, insert, update on public.customers to authenticated;
grant select on public.services to authenticated;
grant insert, update on public.services to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.order_items to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert, update on public.subscriptions to authenticated;
grant select on public.whatsapp_messages to authenticated;
grant select, insert, update on public.reminders to authenticated;
grant select, insert on public.service_rate_history to authenticated;
grant select, update on public.business_settings to authenticated;
grant select, insert on public.backup_exports to authenticated;
grant usage, select on all sequences in schema public to authenticated;

revoke delete on public.customers, public.orders, public.order_items, public.payments,
  public.subscriptions, public.reminders, public.service_rate_history,
  public.whatsapp_messages, public.business_settings, public.backup_exports
  from anon, authenticated;
revoke update, delete on public.payments from anon, authenticated;
revoke insert, update, delete on public.whatsapp_messages from anon, authenticated;
revoke insert, update, delete on public.backup_exports from anon, authenticated;
grant insert, update on public.whatsapp_messages to authenticated;
grant insert, update on public.backup_exports to authenticated;

-- Admin-only configuration and service price changes; staff retain read access.
drop policy if exists "auth business access" on public.services;
drop policy if exists "CleanEazy staff read services" on public.services;
drop policy if exists "CleanEazy admins insert services" on public.services;
drop policy if exists "CleanEazy admins update services" on public.services;
create policy "CleanEazy staff read services"
  on public.services for select to authenticated
  using ((select public.is_active_staff()));
create policy "CleanEazy admins insert services"
  on public.services for insert to authenticated
  with check ((select private.is_admin()));
create policy "CleanEazy admins update services"
  on public.services for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "auth business access" on public.service_rate_history;
drop policy if exists "CleanEazy staff read rate history" on public.service_rate_history;
drop policy if exists "CleanEazy admins add rate history" on public.service_rate_history;
create policy "CleanEazy staff read rate history"
  on public.service_rate_history for select to authenticated
  using ((select public.is_active_staff()));
create policy "CleanEazy admins add rate history"
  on public.service_rate_history for insert to authenticated
  with check ((select private.is_admin()));

drop policy if exists "auth business access" on public.business_settings;
drop policy if exists "CleanEazy staff read settings" on public.business_settings;
drop policy if exists "CleanEazy admins update settings" on public.business_settings;
create policy "CleanEazy staff read settings"
  on public.business_settings for select to authenticated
  using ((select public.is_active_staff()));
create policy "CleanEazy admins update settings"
  on public.business_settings for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "auth business access" on public.backup_exports;
drop policy if exists "CleanEazy admins read backups" on public.backup_exports;
drop policy if exists "CleanEazy admins write backups" on public.backup_exports;
create policy "CleanEazy admins read backups"
  on public.backup_exports for select to authenticated
  using ((select private.is_admin()));
create policy "CleanEazy admins write backups"
  on public.backup_exports for insert to authenticated
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

drop policy if exists "auth business access" on public.whatsapp_messages;
drop policy if exists "CleanEazy staff read WhatsApp queue" on public.whatsapp_messages;
drop policy if exists "CleanEazy admins restore WhatsApp queue" on public.whatsapp_messages;
create policy "CleanEazy staff read WhatsApp queue"
  on public.whatsapp_messages for select to authenticated
  using ((select public.is_active_staff()));
create policy "CleanEazy admins restore WhatsApp queue"
  on public.whatsapp_messages for insert to authenticated
  with check ((select private.is_admin()));
create policy "CleanEazy admins update WhatsApp queue"
  on public.whatsapp_messages for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "auth business access" on public.reminders;
drop policy if exists "CleanEazy staff read reminders" on public.reminders;
drop policy if exists "CleanEazy admins manage reminders" on public.reminders;
create policy "CleanEazy staff read reminders"
  on public.reminders for select to authenticated
  using ((select public.is_active_staff()));
create policy "CleanEazy admins manage reminders"
  on public.reminders for insert to authenticated
  with check ((select private.is_admin()));
create policy "CleanEazy admins update reminders"
  on public.reminders for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Service and order RPCs remain SECURITY INVOKER. The database itself limits order creation,
-- protects the step-by-step status path, and validates every payment, including direct API writes.
create or replace function private.enforce_order_flow()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  flow text[] := array['Pickup Requested','Pickup Assigned','Picked Up','Processing','Washing','Ironing','Quality Check','Ready','Out for Delivery','Delivered'];
  previous_step integer;
  next_step integer;
begin
  if current_setting('cleaneazy.restore', true) = 'on' then return new; end if;
  if tg_op = 'INSERT' then
    if coalesce(new.status,'Pickup Requested') <> 'Pickup Requested' then
      raise exception 'A new order must start at Pickup Requested';
    end if;
    new.status := 'Pickup Requested';
    if new.idempotency_key is null or btrim(new.idempotency_key) = '' then
      raise exception 'An order idempotency key is required';
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status then return new; end if;
  previous_step := array_position(flow, old.status);
  next_step := array_position(flow, new.status);
  if previous_step is null or next_step is null or next_step <> previous_step + 1 then
    raise exception 'Order status must move exactly one step forward';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_cleaneazy_order_insert_flow on public.orders;
drop trigger if exists trg_cleaneazy_order_update_flow on public.orders;
create trigger trg_cleaneazy_order_insert_flow
  before insert on public.orders
  for each row execute function private.enforce_order_flow();
create trigger trg_cleaneazy_order_update_flow
  before update of status on public.orders
  for each row execute function private.enforce_order_flow();

-- An order with no line items cannot be committed through the raw table endpoint.
create or replace function private.require_order_items()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.order_items i where i.order_id = new.id) then
    raise exception 'An order must include at least one service item';
  end if;
  return null;
end;
$$;
drop trigger if exists trg_cleaneazy_order_requires_items on public.orders;
create constraint trigger trg_cleaneazy_order_requires_items
  after insert on public.orders
  deferrable initially deferred
  for each row execute function private.require_order_items();

-- Enforce normalized phone numbers at the database boundary, including duplicate protection.
create or replace function private.normalize_customer_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare digits text;
begin
  digits := regexp_replace(coalesce(new.whatsapp_number,''), '[^0-9]', '', 'g');
  if left(digits,4) = '0091' and length(digits) = 14 then digits := substr(digits,5); end if;
  if left(digits,2) = '91' and length(digits) = 12 then digits := substr(digits,3); end if;
  if left(digits,1) = '0' and length(digits) = 11 then digits := substr(digits,2); end if;
  if length(digits) > 10 then digits := right(digits,10); end if;
  if length(digits) <> 10 then raise exception 'Enter a valid 10-digit Indian WhatsApp number'; end if;
  new.whatsapp_number_normalized := digits;
  return new;
end;
$$;
update public.customers
set whatsapp_number_normalized = right(regexp_replace(coalesce(whatsapp_number,''), '[^0-9]', '', 'g'), 10)
where coalesce(whatsapp_number_normalized,'') = '';
create unique index if not exists customers_active_whatsapp_normalized_uidx
  on public.customers (whatsapp_number_normalized)
  where is_active = true and whatsapp_number_normalized is not null;
drop trigger if exists trg_cleaneazy_normalize_customer_phone on public.customers;
create trigger trg_cleaneazy_normalize_customer_phone
  before insert or update of whatsapp_number, whatsapp_number_normalized on public.customers
  for each row execute function private.normalize_customer_phone();

create unique index if not exists orders_idempotency_key_uidx
  on public.orders (idempotency_key) where idempotency_key is not null;
create unique index if not exists payments_idempotency_key_uidx
  on public.payments (idempotency_key) where idempotency_key is not null;
create unique index if not exists orders_invoice_number_uidx
  on public.orders (invoice_number) where invoice_number is not null;
create index if not exists orders_customer_id_idx on public.orders(customer_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists subscriptions_customer_id_idx on public.subscriptions(customer_id);

-- Queue events are created by trusted database triggers so clients cannot forge a recipient.
create or replace function private.queue_order_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c public.customers%rowtype; event_name text; idem text;
begin
  if current_setting('cleaneazy.restore', true) = 'on' then return new; end if;
  if auth.uid() is null or not exists(select 1 from public.staff_users s where s.user_id=auth.uid() and s.active) then
    raise exception 'Active CleanEazy staff access required';
  end if;
  select * into c from public.customers where id=new.customer_id;
  if tg_op='INSERT' then event_name:='order_received';
  elsif new.status is distinct from old.status then
    event_name:=case new.status
      when 'Pickup Assigned' then 'pickup_assigned' when 'Picked Up' then 'picked_up'
      when 'Processing' then 'processing' when 'Washing' then 'washing_started'
      when 'Ironing' then 'ironing' when 'Quality Check' then 'quality_check'
      when 'Ready' then 'ready' when 'Out for Delivery' then 'out_for_delivery'
      when 'Delivered' then 'delivered' else null end;
  end if;
  if event_name is null then return new; end if;
  idem:='order:'||new.id||':'||event_name;
  insert into public.whatsapp_messages(order_id,customer_id,event,recipient,idempotency_key,payload)
  values(new.id,new.customer_id,event_name,
         coalesce(c.whatsapp_number_normalized,regexp_replace(coalesce(c.whatsapp_number,''),'[^0-9]','','g')),
         idem,jsonb_build_object('order_id',new.id,'order_number',new.order_number,'status',new.status,
           'total_amount',new.total_amount,'paid_amount',new.paid_amount))
  on conflict(idempotency_key) do nothing;
  return new;
end;
$$;
revoke all on function private.queue_order_whatsapp() from public, anon, authenticated;
drop trigger if exists trg_queue_order_whatsapp on public.orders;
create trigger trg_queue_order_whatsapp
  after insert or update of status on public.orders
  for each row execute function private.queue_order_whatsapp();

create or replace function private.queue_payment_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare c public.customers%rowtype; order_customer_id bigint; idem text;
begin
  if current_setting('cleaneazy.restore', true) = 'on' then return new; end if;
  if auth.uid() is null or not exists(select 1 from public.staff_users s where s.user_id=auth.uid() and s.active) then
    raise exception 'Active CleanEazy staff access required';
  end if;
  select customer_id into order_customer_id from public.orders where id=new.order_id;
  select * into c from public.customers where id=order_customer_id;
  idem:='payment:'||new.id;
  insert into public.whatsapp_messages(order_id,customer_id,event,recipient,idempotency_key,payload)
  values(new.order_id,order_customer_id,'payment_confirmation',
    coalesce(c.whatsapp_number_normalized,regexp_replace(coalesce(c.whatsapp_number,''),'[^0-9]','','g')),
    idem,jsonb_build_object('order_id',new.order_id,'payment_amount',new.amount,'payment_method',new.payment_method))
  on conflict(idempotency_key) do nothing;
  return new;
end;
$$;
revoke all on function private.queue_payment_whatsapp() from public, anon, authenticated;
drop trigger if exists trg_queue_payment_whatsapp on public.payments;
create trigger trg_queue_payment_whatsapp
  after insert on public.payments
  for each row execute function private.queue_payment_whatsapp();

-- Protect every payment write, not only calls made by the payment RPC.
create or replace function private.validate_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare total_due numeric; already_paid numeric;
begin
  if new.amount is null or new.amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if new.payment_method not in ('Cash','UPI','Card','Bank Transfer','Other') then raise exception 'Invalid payment method'; end if;
  if new.idempotency_key is null or btrim(new.idempotency_key) = '' then raise exception 'A payment idempotency key is required'; end if;
  perform 1 from public.orders o where o.id=new.order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select o.total_amount into total_due from public.orders o where o.id=new.order_id;
  select coalesce(sum(p.amount),0) into already_paid from public.payments p where p.order_id=new.order_id;
  if new.amount > greatest(total_due-already_paid,0) then raise exception 'Payment exceeds outstanding balance'; end if;
  return new;
end;
$$;
revoke all on function private.validate_payment() from public, anon, authenticated;
drop trigger if exists trg_cleaneazy_validate_payment on public.payments;
create trigger trg_cleaneazy_validate_payment
  before insert on public.payments
  for each row execute function private.validate_payment();

create or replace function public.sync_payment_status()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare v_total numeric(10,2); v_paid numeric(10,2);
begin
  select total_amount into v_total from public.orders where id=new.order_id;
  select coalesce(sum(amount),0) into v_paid from public.payments where order_id=new.order_id;
  update public.orders
     set paid_amount=v_paid,
         payment_status=case when v_paid>=coalesce(v_total,0) and coalesce(v_total,0)>0 then 'Paid'
                             when v_paid>0 then 'Partial' else 'Pending' end,
         updated_at=now()
   where id=new.order_id;
  return new;
end;
$$;

create or replace function public.create_laundry_order(
  p_customer_id bigint,
  p_expected_delivery_date date,
  p_discount numeric default 0,
  p_paid_amount numeric default 0,
  p_payment_method text default 'Cash',
  p_notes text default '',
  p_idempotency_key text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path = 'public'
as $$
declare
  existing public.orders%rowtype;
  v_order public.orders%rowtype;
  item jsonb;
  svc public.services%rowtype;
  quantity numeric;
  v_subtotal numeric(10,2);
  total numeric(10,2);
  paid numeric(10,2);
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 16 then raise exception 'A unique order idempotency key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cleaneazy:order:'||p_idempotency_key,0));
  select * into existing from public.orders where idempotency_key=p_idempotency_key;
  if found then
    if existing.customer_id<>p_customer_id then raise exception 'This order idempotency key belongs to a different customer'; end if;
    return jsonb_build_object('id',existing.id,'order_number',existing.order_number,'invoice_number',existing.invoice_number,'duplicate',true);
  end if;
  if not exists(select 1 from public.customers c where c.id=p_customer_id and c.is_active) then raise exception 'Customer not found or inactive'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Add at least one order item'; end if;
  if coalesce(p_discount,0)<0 or coalesce(p_paid_amount,0)<0 then raise exception 'Discount and payment cannot be negative'; end if;

  insert into public.orders(order_number,invoice_number,customer_id,expected_delivery_date,status,subtotal,discount,total_amount,paid_amount,payment_status,notes,pickup_status,pickup_requested_at,idempotency_key)
  values(null,null,p_customer_id,p_expected_delivery_date,'Pickup Requested',0,0,0,0,'Pending',coalesce(p_notes,''),'Requested',now(),p_idempotency_key)
  returning * into v_order;

  for item in select value from jsonb_array_elements(p_items) loop
    select * into svc from public.services where id=(item->>'service_id')::bigint and active and not is_deleted;
    if not found then raise exception 'One of the selected services is inactive or unavailable'; end if;
    quantity:=coalesce((item->>'quantity')::numeric,0);
    if quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
    insert into public.order_items(order_id,service_id,item_name,quantity,unit,rate,amount)
    values(v_order.id,svc.id,svc.service_name,quantity,svc.unit_type,svc.rate,round(quantity*svc.rate,2));
  end loop;

  select coalesce(sum(i.amount),0)::numeric(10,2) into v_subtotal from public.order_items i where i.order_id=v_order.id;
  total:=greatest(v_subtotal-coalesce(p_discount,0),0)::numeric(10,2);
  paid:=coalesce(p_paid_amount,0)::numeric(10,2);
  if paid>total then raise exception 'Initial payment exceeds order total'; end if;
  if paid>0 and coalesce(p_payment_method,'Cash') not in ('Cash','UPI','Card','Bank Transfer','Other') then raise exception 'Invalid payment method'; end if;
  update public.orders set invoice_number=v_order.order_number,subtotal=v_subtotal,discount=coalesce(p_discount,0),total_amount=total,updated_at=now() where id=v_order.id;
  if paid>0 then
    insert into public.payments(order_id,amount,payment_method,idempotency_key)
    values(v_order.id,paid,coalesce(p_payment_method,'Cash'),p_idempotency_key||':initial-payment');
  end if;
  select * into v_order from public.orders where id=v_order.id;
  return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'invoice_number',v_order.invoice_number,
    'subtotal',v_order.subtotal,'total_amount',v_order.total_amount,'paid_amount',v_order.paid_amount,
    'payment_status',v_order.payment_status,'status',v_order.status,'duplicate',false);
end;
$$;

drop function if exists public.record_laundry_payment(bigint,numeric,text,text,text);
create function public.record_laundry_payment(
  p_order_id bigint,
  p_amount numeric,
  p_method text,
  p_reference text default '',
  p_idempotency_key text default null,
  p_payment_date timestamptz default now(),
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = 'public'
as $$
declare
  existing public.payments%rowtype;
  ord public.orders%rowtype;
  result public.orders%rowtype;
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 16 then raise exception 'A unique payment idempotency key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cleaneazy:payment:'||p_idempotency_key,0));
  select * into existing from public.payments where idempotency_key=p_idempotency_key;
  if found then
    if existing.order_id<>p_order_id or existing.amount<>p_amount or existing.payment_method<>p_method
       or existing.reference_number is distinct from coalesce(p_reference,'')
       or existing.payment_date is distinct from p_payment_date
       or existing.notes is distinct from nullif(btrim(p_notes),'') then
      raise exception 'Payment idempotency key was reused with different details';
    end if;
    select * into result from public.orders where id=p_order_id;
    return to_jsonb(result)||jsonb_build_object('duplicate',true);
  end if;
  select * into ord from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_method not in ('Cash','UPI','Card','Bank Transfer','Other') then raise exception 'Invalid payment method'; end if;
  if p_amount>greatest(ord.total_amount-coalesce(ord.paid_amount,0),0) then raise exception 'Payment exceeds outstanding balance'; end if;
  insert into public.payments(order_id,amount,payment_method,reference_number,idempotency_key,payment_date,notes)
  values(p_order_id,p_amount,p_method,coalesce(p_reference,''),p_idempotency_key,coalesce(p_payment_date,now()),nullif(btrim(p_notes),''));
  select * into result from public.orders where id=p_order_id;
  return to_jsonb(result)||jsonb_build_object('duplicate',false);
end;
$$;

revoke all on function public.create_laundry_order(bigint,date,numeric,numeric,text,text,text,jsonb) from public, anon;
revoke all on function public.record_laundry_payment(bigint,numeric,text,text,text,timestamptz,text) from public, anon;
revoke all on function public.change_order_status(bigint,text) from public, anon;
grant execute on function public.create_laundry_order(bigint,date,numeric,numeric,text,text,text,jsonb) to authenticated;
grant execute on function public.record_laundry_payment(bigint,numeric,text,text,text,timestamptz,text) to authenticated;
grant execute on function public.change_order_status(bigint,text) to authenticated;
grant execute on function public.is_active_staff() to authenticated;

-- A single atomic restore function upserts records in dependency order and pauses work queues.
create or replace function public.restore_cleaneazy_backup(p_backup jsonb)
returns jsonb
language plpgsql
set search_path = 'public'
as $$
declare
  table_name text;
  rows_json jsonb;
  updates text;
  sequence_name text;
  max_id bigint;
  sequence_last bigint;
  changed bigint;
  counts jsonb := '{}'::jsonb;
  verified_counts jsonb := '{}'::jsonb;
  item jsonb;
  allowed text[] := array['customers','services','orders','order_items','payments','subscriptions','reminders','whatsapp_messages','service_rate_history','business_settings'];
  restore_order text[] := array['customers','services','orders','order_items','payments','subscriptions','reminders','whatsapp_messages','service_rate_history','business_settings'];
begin
  if auth.uid() is null or not private.is_admin() then raise exception 'Administrator access required'; end if;
  if p_backup->>'format' is distinct from 'cleaneazy-backup' or coalesce((p_backup->>'version')::integer,0)<>1 then raise exception 'Unsupported CleanEazy backup format'; end if;
  if jsonb_typeof(p_backup->'data')<>'object' then raise exception 'Backup is missing its data object'; end if;
  perform set_config('cleaneazy.restore','on',true);

  foreach table_name in array restore_order loop
    if not (table_name=any(allowed)) then raise exception 'Unsupported backup table'; end if;
    rows_json:=coalesce(p_backup->'data'->table_name,'[]'::jsonb);
    if jsonb_typeof(rows_json)<>'array' then raise exception 'Backup section % must be an array',table_name; end if;
    if table_name in ('whatsapp_messages','reminders') then
      select coalesce(jsonb_agg(
        case
          when table_name='whatsapp_messages' and value->>'status' in ('pending','processing') then
            jsonb_set(jsonb_set(value,'{status}','"failed"'::jsonb),'{last_error}',to_jsonb('Restored from backup; review before retry.'::text),true)
          when table_name='reminders' and value->>'status'='pending' then
            jsonb_set(jsonb_set(value,'{status}','"failed"'::jsonb),'{last_error}',to_jsonb('Restored from backup; review before rescheduling.'::text),true)
          else value
        end), '[]'::jsonb) into rows_json
      from jsonb_array_elements(rows_json);
    end if;
    if jsonb_array_length(rows_json)=0 then counts:=counts||jsonb_build_object(table_name,0); continue; end if;
    if table_name in ('payments','reminders','whatsapp_messages','service_rate_history') then
      execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1) on conflict (id) do nothing',table_name,table_name) using rows_json;
    else
      select string_agg(format('%I=excluded.%I',a.attname,a.attname),', ' order by a.attnum)
      into updates
      from pg_attribute a
      where a.attrelid=format('public.%I',table_name)::regclass and a.attnum>0 and not a.attisdropped and a.attname<>'id';
      execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1) on conflict (id) do update set %s',table_name,table_name,updates) using rows_json;
    end if;
    get diagnostics changed = row_count;
    counts:=counts||jsonb_build_object(table_name,changed);
    sequence_name:=pg_get_serial_sequence(format('public.%I',table_name),'id');
    if sequence_name is not null then
      execute format('select max(id) from public.%I',table_name) into max_id;
      if max_id is not null then
        execute format('select last_value from %s',sequence_name::regclass) into sequence_last;
        perform setval(sequence_name,greatest(max_id,coalesce(sequence_last,1)),true);
      end if;
    end if;
  end loop;
  foreach table_name in array restore_order loop
    execute format('select count(*) from public.%I',table_name) into changed;
    verified_counts:=verified_counts||jsonb_build_object(table_name,changed);
  end loop;
  insert into public.backup_exports(created_by,export_type,record_counts)
  values(auth.uid(),'restore',verified_counts);
  return jsonb_build_object('ok',true,'restored_counts',counts,'verified_counts',verified_counts);
end;
$$;
revoke all on function public.restore_cleaneazy_backup(jsonb) from public, anon;
grant execute on function public.restore_cleaneazy_backup(jsonb) to authenticated;

