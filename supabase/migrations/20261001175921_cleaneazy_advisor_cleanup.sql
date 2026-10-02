-- Keep policies and idempotency indexes efficient after the application migration.
drop index if exists public.orders_idempotency_key_uidx;
drop index if exists public.payments_idempotency_key_uidx;

drop policy if exists "CleanEazy staff can view own profile" on public.staff_users;
drop policy if exists "CleanEazy admins can view team" on public.staff_users;
drop policy if exists "CleanEazy team can view permitted profiles" on public.staff_users;
create policy "CleanEazy team can view permitted profiles"
  on public.staff_users for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

