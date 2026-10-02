-- Guard core amounts and workflow values even when a caller bypasses the UI.
do $constraints$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.services'::regclass and conname='services_rate_nonnegative') then
    alter table public.services add constraint services_rate_nonnegative check (rate >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_items'::regclass and conname='order_items_quantity_positive') then
    alter table public.order_items add constraint order_items_quantity_positive check (quantity > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.order_items'::regclass and conname='order_items_amounts_nonnegative') then
    alter table public.order_items add constraint order_items_amounts_nonnegative check (rate >= 0 and amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_amounts_nonnegative') then
    alter table public.orders add constraint orders_amounts_nonnegative check (subtotal >= 0 and discount >= 0 and total_amount >= 0 and paid_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_status_valid') then
    alter table public.orders add constraint orders_status_valid check (status in ('Pickup Requested','Pickup Assigned','Picked Up','Processing','Washing','Ironing','Quality Check','Ready','Out for Delivery','Delivered'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payments'::regclass and conname='payments_method_valid') then
    alter table public.payments add constraint payments_method_valid check (payment_method in ('Cash','UPI','Card','Bank Transfer','Other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payments'::regclass and conname='payments_amount_positive') then
    alter table public.payments add constraint payments_amount_positive check (amount > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.subscriptions'::regclass and conname='subscriptions_allowance_nonnegative') then
    alter table public.subscriptions add constraint subscriptions_allowance_nonnegative check (weekly_limit_kg >= 0 and used_kg >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.subscriptions'::regclass and conname='subscriptions_amounts_nonnegative') then
    alter table public.subscriptions add constraint subscriptions_amounts_nonnegative check (registration_fee >= 0 and monthly_amount >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.subscriptions'::regclass and conname='subscriptions_date_range_valid') then
    alter table public.subscriptions add constraint subscriptions_date_range_valid check (expiry_date >= start_date);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.reminders'::regclass and conname='reminders_status_valid') then
    alter table public.reminders add constraint reminders_status_valid check (status in ('pending','queued','sent','failed','cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.whatsapp_messages'::regclass and conname='whatsapp_messages_status_valid') then
    alter table public.whatsapp_messages add constraint whatsapp_messages_status_valid check (status in ('pending','processing','sent','delivered','read','failed'));
  end if;
end;
$constraints$;

