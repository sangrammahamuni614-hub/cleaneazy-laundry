-- Settings restores use INSERT .. ON CONFLICT even when a row with the same ID exists.
grant insert on public.business_settings to authenticated;
drop policy if exists "CleanEazy admins insert settings" on public.business_settings;
create policy "CleanEazy admins insert settings"
  on public.business_settings for insert to authenticated
  with check ((select private.is_admin()));

-- The order-created event is queued by the order INSERT trigger before the RPC
-- has inserted line items. Refresh its payload as the final order totals settle.
create or replace function private.sync_order_received_queue()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('cleaneazy.restore', true) = 'on' then return new; end if;
  if auth.uid() is null or not exists (
    select 1 from public.staff_users s where s.user_id = auth.uid() and s.active
  ) then
    raise exception 'Active CleanEazy staff access required';
  end if;
  update public.whatsapp_messages m
     set payload = jsonb_build_object(
       'order_id', new.id,
       'order_number', new.order_number,
       'status', new.status,
       'total_amount', new.total_amount,
       'paid_amount', new.paid_amount
     )
   where m.idempotency_key = 'order:' || new.id || ':order_received'
     and m.status in ('pending','processing');
  return new;
end;
$$;
revoke all on function private.sync_order_received_queue() from public, anon, authenticated;
drop trigger if exists trg_sync_order_received_queue on public.orders;
create trigger trg_sync_order_received_queue
  after update of subtotal,total_amount,paid_amount on public.orders
  for each row execute function private.sync_order_received_queue();

