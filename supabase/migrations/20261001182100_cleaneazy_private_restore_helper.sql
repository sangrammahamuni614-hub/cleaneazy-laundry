alter function public.restore_cleaneazy_backup(jsonb) set schema private;
alter function private.restore_cleaneazy_backup(jsonb) rename to restore_cleaneazy_backup_internal;
grant usage on schema private to authenticated;
revoke all on function private.restore_cleaneazy_backup_internal(jsonb) from public, anon;
grant execute on function private.restore_cleaneazy_backup_internal(jsonb) to authenticated;

create or replace function public.restore_cleaneazy_backup(p_backup jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator access required';
  end if;
  return private.restore_cleaneazy_backup_internal(p_backup);
end;
$$;
revoke all on function public.restore_cleaneazy_backup(jsonb) from public, anon;
grant execute on function public.restore_cleaneazy_backup(jsonb) to authenticated;

