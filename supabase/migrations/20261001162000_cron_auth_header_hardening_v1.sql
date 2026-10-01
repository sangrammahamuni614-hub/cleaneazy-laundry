-- Keep the internal cron secret out of URLs and pass it only as a request header.
select cron.alter_job(
  (select jobid from cron.job where jobname='cleaneazy-reminders-hourly'),
  schedule => '5 * * * *',
  command => $job$
    select public.queue_due_reminders();
    select net.http_post(
      url:='https://jcckvihjumqdmkcbaebo.supabase.co/functions/v1/send-whatsapp',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'apikey','sb_publishable_60V5TTfgADs2RwN_WAZSXw_VLTxbyJQ',
        'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cleaneazy_cron_secret' limit 1)
      ),
      body:='{"limit":50}'::jsonb,
      timeout_milliseconds:=10000
    ) as request_id;
  $job$
);