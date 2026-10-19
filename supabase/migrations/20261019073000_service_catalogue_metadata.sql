-- Add service catalogue metadata without changing existing rates or order snapshots.
alter table public.services
  add column if not exists category text not null default 'सामान्य',
  add column if not exists description text not null default '';

update public.services
set category = case
  when service_name = 'धुलाई' then 'धुलाई'
  when service_name = 'धुलाई + इस्त्री' then 'धुलाई + इस्त्री'
  when service_name like 'फक्त इस्त्री%' then 'फक्त इस्त्री'
  when service_name like 'ड्रायक्लीन%' then 'ड्रायक्लीन'
  when service_name = 'ब्लँकेट' then 'घरगुती वस्तू'
  when service_name = 'बॅग / शूज' then 'बॅग व शूज'
  when service_name in ('शर्ट / पँट','इतर कपडे') then 'कपडे'
  else coalesce(nullif(category,''),'सामान्य')
end
where category = 'सामान्य';
