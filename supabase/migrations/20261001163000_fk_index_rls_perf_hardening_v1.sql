-- Production performance hardening: cover foreign keys and optimize auth.uid() RLS expressions.
create index if not exists backup_exports_created_by_idx on public.backup_exports(created_by);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_service_id_idx on public.order_items(service_id);
create index if not exists reminders_customer_id_idx on public.reminders(customer_id);
create index if not exists reminders_order_id_idx on public.reminders(order_id);
create index if not exists service_rate_history_service_id_idx on public.service_rate_history(service_id);
create index if not exists subscriptions_customer_id_idx on public.subscriptions(customer_id);
create index if not exists whatsapp_messages_customer_id_idx on public.whatsapp_messages(customer_id);
create index if not exists whatsapp_messages_order_id_idx on public.whatsapp_messages(order_id);

drop policy if exists "staff can view own profile" on public.staff_users;
create policy "staff can view own profile" on public.staff_users
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "staff can update own display name" on public.staff_users;
create policy "staff can update own display name" on public.staff_users
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
