-- CleanEazy Production Completion
-- This migration records the production hardening deployed to project jcckvihjumqdmkcbaebo.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create index if not exists orders_customer_date_idx on public.orders(customer_id,order_date desc);
create index if not exists orders_status_delivery_idx on public.orders(status,expected_delivery_date);
create index if not exists payments_order_date_idx on public.payments(order_id,payment_date desc);
create index if not exists payments_method_date_idx on public.payments(payment_method,payment_date desc);
create index if not exists subscriptions_expiry_idx on public.subscriptions(active,expiry_date);
create index if not exists customers_area_idx on public.customers(area);
create unique index if not exists whatsapp_provider_message_id_uq on public.whatsapp_messages(provider_message_id) where provider_message_id is not null;

create or replace function public.create_laundry_order(
  p_customer_id bigint,p_expected_delivery_date date,p_discount numeric default 0,
  p_paid_amount numeric default 0,p_payment_method text default 'Cash',
  p_notes text default '',p_idempotency_key text default null,
  p_items jsonb default '[]'::jsonb
) returns jsonb language plpgsql set search_path=public as $$
declare existing_id bigint;v_order_id bigint;v_order_number text;
v_subtotal numeric:=0;v_total numeric:=0;v_paid numeric:=greatest(coalesce(p_paid_amount,0),0);
item jsonb;s public.services%rowtype;q numeric;
begin
 if p_idempotency_key is not null then
   select id into existing_id from public.orders where idempotency_key=p_idempotency_key;
   if existing_id is not null then return jsonb_build_object('id',existing_id,'duplicate',true); end if;
 end if;
 if not exists(select 1 from public.customers where id=p_customer_id and coalesce(is_active,true)) then
   raise exception 'Customer not found or inactive';
 end if;
 select 'CE'||lpad((coalesce(max(nullif(regexp_replace(order_number,'\D','','g'),'' )::bigint),1000)+1)::text,5,'0') into v_order_number from public.orders;
 insert into public.orders(order_number,invoice_number,customer_id,expected_delivery_date,status,discount,total_amount,paid_amount,payment_status,notes,pickup_status,pickup_requested_at,idempotency_key)
 values(v_order_number,v_order_number,p_customer_id,p_expected_delivery_date,'Pickup Requested',greatest(coalesce(p_discount,0),0),0,0,'Pending',p_notes,'Requested',now(),p_idempotency_key)
 returning id into v_order_id;
 for item in select * from jsonb_array_elements(p_items) loop
   select * into s from public.services where id=(item->>'service_id')::bigint and coalesce(active,true) and not coalesce(is_deleted,false);
   if not found then raise exception 'Invalid service'; end if;
   q:=greatest(coalesce((item->>'quantity')::numeric,0),0);
   if q<=0 then raise exception 'Quantity must be greater than zero'; end if;
   insert into public.order_items(order_id,service_id,item_name,quantity,unit,rate,amount) values(v_order_id,s.id,s.service_name,q,s.unit_type,s.rate,q*s.rate);
   v_subtotal:=v_subtotal+(q*s.rate);
 end loop;
 v_total:=greatest(v_subtotal-greatest(coalesce(p_discount,0),0),0);
 if v_paid>v_total then v_paid:=v_total; end if;
 update public.orders set subtotal=v_subtotal,total_amount=v_total,paid_amount=v_paid,
   payment_status=case when v_paid<=0 then 'Pending' when v_paid>=v_total then 'Paid' else 'Partial' end,
   updated_at=now() where id=v_order_id;
 if v_paid>0 then
   insert into public.payments(order_id,amount,payment_method,idempotency_key)
   values(v_order_id,v_paid,coalesce(p_payment_method,'Cash'),coalesce(p_idempotency_key,'order:'||v_order_id||':payment'));
 end if;
 return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'invoice_number',v_order_number,
   'subtotal',v_subtotal,'total_amount',v_total,'paid_amount',v_paid,
   'payment_status',(select payment_status from public.orders where id=v_order_id),'status','Pickup Requested');
end; $$;

create or replace function public.change_order_status(p_order_id bigint,p_status text)
returns jsonb language plpgsql set search_path=public as $$
declare current_status text;current_rank integer;new_rank integer;
begin
 if p_status not in ('Pickup Requested','Pickup Assigned','Picked Up','Processing','Washing','Ironing','Quality Check','Ready','Out for Delivery','Delivered') then
   raise exception 'Invalid status';
 end if;
 select status into current_status from public.orders where id=p_order_id;
 if current_status is null then raise exception 'Order not found'; end if;
 current_rank:=array_position(array['Pickup Requested','Pickup Assigned','Picked Up','Processing','Washing','Ironing','Quality Check','Ready','Out for Delivery','Delivered'],current_status);
 new_rank:=array_position(array['Pickup Requested','Pickup Assigned','Picked Up','Processing','Washing','Ironing','Quality Check','Ready','Out for Delivery','Delivered'],p_status);
 if new_rank<current_rank then raise exception 'Status cannot move backward'; end if;
 update public.orders set status=p_status,
   pickup_status=case when p_status='Pickup Requested' then 'Requested'
   when p_status='Pickup Assigned' then 'Assigned'
   when p_status='Picked Up' then 'Picked Up'
   when p_status in ('Processing','Washing','Ironing','Quality Check','Ready') then 'Picked Up'
   when p_status='Out for Delivery' then 'Out for Delivery'
   when p_status='Delivered' then 'Delivered' else pickup_status end,
   pickup_assigned_to=case when p_status='Pickup Assigned' and pickup_assigned_to is null then 'Unassigned' else pickup_assigned_to end,
   pickup_requested_at=case when p_status='Pickup Requested' and pickup_requested_at is null then now() else pickup_requested_at end,
   picked_up_at=case when p_status='Picked Up' and picked_up_at is null then now() else picked_up_at end,
   washing_started_at=case when p_status='Washing' and washing_started_at is null then now() else washing_started_at end,
   ready_at=case when p_status='Ready' and ready_at is null then now() else ready_at end,
   out_for_delivery_at=case when p_status='Out for Delivery' and out_for_delivery_at is null then now() else out_for_delivery_at end,
   delivered_at=case when p_status='Delivered' and delivered_at is null then now() else delivered_at end,
   updated_at=now()
 where id=p_order_id;
 return (select to_jsonb(o) from public.orders o where id=p_order_id);
end; $$;

create or replace function public.refresh_subscription_usage(p_customer_id bigint)
returns void language plpgsql security invoker set search_path=public as $$
declare s record;wk date;kg numeric;
begin
 wk:=date_trunc('week',current_date)::date;
 for s in select * from public.subscriptions where customer_id=p_customer_id and active=true and current_date between start_date and expiry_date loop
   select coalesce(sum(oi.quantity),0) into kg
   from public.orders o join public.order_items oi on oi.order_id=o.id
   where o.customer_id=p_customer_id
     and o.order_date::date>=greatest(wk,s.start_date)
     and o.order_date::date<least(wk+7,s.expiry_date+1)
     and o.order_date::date between s.start_date and s.expiry_date
     and oi.unit='kg';
   update public.subscriptions set usage_week_start=wk,used_kg=kg,updated_at=now() where id=s.id;
 end loop;
end; $$;

create or replace function public.subscription_remaining_kg(p_subscription_id bigint)
returns numeric language sql stable security invoker set search_path=public as $$
 select greatest(coalesce(weekly_limit_kg,0)-coalesce(used_kg,0),0) from public.subscriptions where id=p_subscription_id;
$$;

create or replace function public.verify_cron_secret(p_secret text)
returns boolean language sql stable security definer set search_path=public,vault as $$
 select coalesce((select decrypted_secret=p_secret from vault.decrypted_secrets where name='cleaneazy_cron_secret' limit 1),false);
$$;
revoke all on function public.verify_cron_secret(text) from public,anon,authenticated;
grant execute on function public.verify_cron_secret(text) to service_role;

create or replace function public.queue_due_reminders()
returns integer language plpgsql security definer set search_path=public as $$
declare queued integer:=0;s record;r record;idem text;
begin
 for s in select sub.*,cu.whatsapp_number,cu.whatsapp_number_normalized from public.subscriptions sub join public.customers cu on cu.id=sub.customer_id
  where sub.active=true and sub.expiry_date between current_date and current_date+3 loop
   idem:='subscription-expiry:'||s.id||':'||s.expiry_date::text;
   insert into public.reminders(customer_id,reminder_type,scheduled_at,message,status,idempotency_key)
   values(s.customer_id,'Subscription Expiry',now(),'Your CleanEazy subscription expires on '||s.expiry_date::text||'. Please renew to continue your benefits.','pending',idem)
   on conflict(idempotency_key) do nothing;
 end loop;
 for r in select rem.*,cu.whatsapp_number,cu.whatsapp_number_normalized from public.reminders rem join public.customers cu on cu.id=rem.customer_id
  where rem.status='pending' and rem.scheduled_at<=now() order by rem.scheduled_at limit 200 loop
   idem:='reminder:'||r.id::text;
   insert into public.whatsapp_messages(order_id,customer_id,event,recipient,template_language,payload,status,attempts,next_attempt_at,idempotency_key)
   values(r.order_id,r.customer_id,'outstanding_reminder',coalesce(r.whatsapp_number_normalized,r.whatsapp_number),'en_US',
          jsonb_build_object('reminder_id',r.id,'message',r.message,'reminder_type',r.reminder_type),'pending',0,now(),idem)
   on conflict(idempotency_key) do nothing;
   update public.reminders set status='queued' where id=r.id and status='pending';
   queued:=queued+1;
 end loop;
 return queued;
end; $$;
revoke all on function public.queue_due_reminders() from public,anon,authenticated;
grant execute on function public.queue_due_reminders() to service_role;

do $$
begin
 drop policy if exists "auth backup exports" on public.backup_exports;
 drop policy if exists "auth business settings" on public.business_settings;
 drop policy if exists "authenticated read customers" on public.customers;
 drop policy if exists "authenticated update customers" on public.customers;
 drop policy if exists "authenticated write customers" on public.customers;
 drop policy if exists "customers_authenticated_all" on public.customers;
 drop policy if exists "authenticated read order items" on public.order_items;
 drop policy if exists "authenticated update order items" on public.order_items;
 drop policy if exists "authenticated write order items" on public.order_items;
 drop policy if exists "order_items_authenticated_all" on public.order_items;
 drop policy if exists "authenticated read orders" on public.orders;
 drop policy if exists "authenticated update orders" on public.orders;
 drop policy if exists "authenticated write orders" on public.orders;
 drop policy if exists "orders_authenticated_all" on public.orders;
 drop policy if exists "authenticated read payments" on public.payments;
 drop policy if exists "authenticated update payments" on public.payments;
 drop policy if exists "authenticated write payments" on public.payments;
 drop policy if exists "payments_authenticated_all" on public.payments;
 drop policy if exists "auth reminders all" on public.reminders;
 drop policy if exists "auth service rate history all" on public.service_rate_history;
 drop policy if exists "authenticated read services" on public.services;
 drop policy if exists "authenticated update services" on public.services;
 drop policy if exists "authenticated write services" on public.services;
 drop policy if exists "services_authenticated_all" on public.services;
 drop policy if exists "auth subscriptions all" on public.subscriptions;
 drop policy if exists "auth whatsapp messages all" on public.whatsapp_messages;
end $$;

select vault.create_secret(
  encode(gen_random_bytes(32),'hex'),
  'cleaneazy_cron_secret',
  'CleanEazy internal cron authentication secret'
)
where not exists(select 1 from vault.secrets where name='cleaneazy_cron_secret');

do $$
declare jid bigint;
begin
 select jobid into jid from cron.job where jobname='cleaneazy-reminders-hourly';
 if jid is not null then perform cron.unschedule(jid); end if;
end $$;

select cron.schedule(
 'cleaneazy-reminders-hourly',
 '5 * * * *',
 $job$
   select public.queue_due_reminders();
   select net.http_post(
     url:='https://jcckvihjumqdmkcbaebo.supabase.co/functions/v1/send-whatsapp?cron_secret=' ||
     (select decrypted_secret from vault.decrypted_secrets where name='cleaneazy_cron_secret' limit 1),
     headers:=jsonb_build_object(
       'Content-Type','application/json',
       'apikey','sb_publishable_60V5TTfgADs2RwN_WAZSXw_VLTxbyJQ'
     ),
     body:='{"limit":50}'::jsonb,
     timeout_milliseconds:=10000
   ) as request_id;
 $job$
);
