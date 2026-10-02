create or replace function public.record_laundry_payment(
  p_order_id bigint,
  p_amount numeric,
  p_method text,
  p_reference text default '',
  p_idempotency_key text default null,
  p_payment_date timestamptz default now(),
  p_notes text default null
)
returns jsonb
language plpgsql
set search_path = 'public'
as $$
declare
  existing public.payments%rowtype;
  ord public.orders%rowtype;
  result public.orders%rowtype;
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 16 then raise exception 'A unique payment idempotency key is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cleaneazy:payment:'||p_idempotency_key,0));
  select * into existing from public.payments where idempotency_key=p_idempotency_key;
  if found then
    if existing.order_id<>p_order_id or existing.amount<>p_amount or existing.payment_method<>p_method
       or existing.reference_number is distinct from coalesce(p_reference,'')
       or existing.payment_date is distinct from p_payment_date
       or existing.notes is distinct from nullif(btrim(p_notes),'') then
      raise exception 'Payment idempotency key was reused with different details';
    end if;
    select * into result from public.orders where id=p_order_id;
    return to_jsonb(result)||jsonb_build_object('duplicate',true);
  end if;
  select * into ord from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
  if p_method not in ('Cash','UPI','Card','Bank Transfer','Other') then raise exception 'Invalid payment method'; end if;
  if p_amount>greatest(ord.total_amount-coalesce(ord.paid_amount,0),0) then raise exception 'Payment exceeds outstanding balance'; end if;
  insert into public.payments(order_id,amount,payment_method,reference_number,idempotency_key,payment_date,notes)
  values(p_order_id,p_amount,p_method,coalesce(p_reference,''),p_idempotency_key,coalesce(p_payment_date,now()),nullif(btrim(p_notes),''));
  select * into result from public.orders where id=p_order_id;
  return to_jsonb(result)||jsonb_build_object('duplicate',false);
end;
$$;

revoke all on function public.record_laundry_payment(bigint,numeric,text,text,text,timestamptz,text) from public, anon;
grant execute on function public.record_laundry_payment(bigint,numeric,text,text,text,timestamptz,text) to authenticated;

