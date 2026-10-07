-- Add explicit subscription period semantics without changing existing rows.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS limit_period text NOT NULL DEFAULT 'week';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_limit_period_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_limit_period_check
  CHECK (limit_period IN ('week', 'month'));

CREATE OR REPLACE FUNCTION public.refresh_subscription_usage(p_customer_id bigint)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  s record;
  period_start date;
  period_end date;
  kg numeric;
begin
  for s in
    select *
      from public.subscriptions
     where customer_id = p_customer_id
       and active = true
       and current_date between start_date and expiry_date
  loop
    if s.limit_period = 'month' then
      period_start := date_trunc('month', current_date)::date;
      period_end := (period_start + interval '1 month')::date;
    else
      period_start := date_trunc('week', current_date)::date;
      period_end := period_start + 7;
    end if;

    select coalesce(sum(oi.quantity), 0)
      into kg
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
     where o.customer_id = p_customer_id
       and o.order_date::date >= greatest(period_start, s.start_date)
       and o.order_date::date < least(period_end, s.expiry_date + 1)
       and o.order_date::date between s.start_date and s.expiry_date
       and oi.unit = 'kg';

    update public.subscriptions
       set usage_week_start = period_start,
           used_kg = kg,
           updated_at = now()
     where id = s.id;
  end loop;
end;
$function$;
