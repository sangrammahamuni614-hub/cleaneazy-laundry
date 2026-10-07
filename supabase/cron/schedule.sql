-- The connected project already has the active `cleaneazy-reminders-hourly` job.
-- Do not run cron.schedule() again: doing so would duplicate production delivery.
-- Inspect the existing schedule and recent executions with these read-only queries:
select jobid, jobname, schedule, active
from cron.job
where jobname = 'cleaneazy-reminders-hourly';

select j.jobname, r.status, r.start_time, left(coalesce(r.return_message, ''), 180) as result
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname = 'cleaneazy-reminders-hourly'
order by r.start_time desc
limit 20;
