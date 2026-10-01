-- Prevent zero/negative payments and over-collection at the database boundary.
create or replace function public.record_laundry_payment(
  p_order_id bigint,
  p_amount numeric,
  p_method text,
  p_reference text default '',
  p_idempotency_key text default null
) returns jsonb
language plpgsql
set search_path=public
as $$
declare
  o public.orders%rowtype;
  new_paid numeric;
  balance numeric;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_idempotency_key is not null and exists(
    select 1 from public.payments where idempotency_key=p_idempotency_key
  ) then
    return (select to_jsonb(x) from public.orders x where x.id=p_order_id);
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  balance:=greatest(coalesce(o.total_amount,0)-coalesce(o.paid_amount,0),0);
  if p_amount > balance then
    raise exception 'Payment exceeds outstanding balance';
  end if;

  new_paid:=coalesce(o.paid_amount,0)+p_amount;
  insert into public.payments(order_id,amount,payment_method,reference_number,idempotency_key)
  values(p_order_id,p_amount,coalesce(p_method,'Cash'),p_reference,p_idempotency_key);

  update public.orders
  set paid_amount=new_paid,
      payment_status=case
        when new_paid<=0 then 'Pending'
        when new_paid>=total_amount then 'Paid'
        else 'Partial'
      end,
      updated_at=now()
  where id=p_order_id;

  return (select to_jsonb(x) from public.orders x where id=p_order_id);
end;
$$;