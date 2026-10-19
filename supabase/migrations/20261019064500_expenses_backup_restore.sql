-- Extend the existing atomic backup restore allow-list to include the expense ledger.
do $$
declare
  definition text;
  old_list text := 'array[''customers'',''services'',''orders'',''order_items'',''payments'',''subscriptions'',''reminders'',''whatsapp_messages'',''service_rate_history'',''business_settings'']';
  new_list text := 'array[''customers'',''services'',''orders'',''order_items'',''payments'',''business_expenses'',''subscriptions'',''reminders'',''whatsapp_messages'',''service_rate_history'',''business_settings'']';
begin
  select pg_get_functiondef('private.restore_cleaneazy_backup_internal(jsonb)'::regprocedure) into definition;
  if position(old_list in definition) = 0 then
    raise exception 'Expected CleanEazy backup allow-list was not found; refusing to change restore function';
  end if;
  definition := replace(definition, old_list, new_list);
  execute definition;
end $$;
