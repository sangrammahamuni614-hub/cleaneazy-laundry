-- Restore needs to advance identity sequences and upsert related tables. Run it
-- with database-owner privileges only after checking the caller is an admin.
alter function public.restore_cleaneazy_backup(jsonb) security definer;
alter function public.restore_cleaneazy_backup(jsonb) set search_path to '';

