-- Apply the welcome offer once, to each customer's first order, inside the
-- same transaction that creates the order. p_discount remains an optional
-- additional staff discount; orders.discount stores both discounts together.
CREATE OR REPLACE FUNCTION public.create_laundry_order(
  p_customer_id bigint,
  p_expected_delivery_date date,
  p_discount numeric DEFAULT 0,
  p_paid_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'Cash',
  p_notes text DEFAULT '',
  p_idempotency_key text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  existing public.orders%rowtype;
  v_order public.orders%rowtype;
  item jsonb;
  svc public.services%rowtype;
  quantity numeric;
  v_subtotal numeric(10,2);
  v_manual_discount numeric(10,2);
  v_welcome_discount numeric(10,2) := 0;
  v_total_discount numeric(10,2);
  v_is_first_order boolean := false;
  total numeric(10,2);
  paid numeric(10,2);
begin
  if p_idempotency_key is null or length(btrim(p_idempotency_key)) < 16 then
    raise exception 'A unique order idempotency key is required';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cleaneazy:order:' || p_idempotency_key, 0));
  select * into existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    if existing.customer_id <> p_customer_id then
      raise exception 'This order idempotency key belongs to a different customer';
    end if;
    return jsonb_build_object('id', existing.id, 'order_number', existing.order_number,
      'invoice_number', existing.invoice_number, 'duplicate', true);
  end if;

  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.is_active) then
    raise exception 'Customer not found or inactive';
  end if;
  -- Serialize first orders for the same customer so two concurrent requests
  -- cannot both receive the welcome offer.
  perform pg_advisory_xact_lock(hashtextextended('cleaneazy:first-order:' || p_customer_id::text, 0));
  if not exists (select 1 from public.orders o where o.customer_id = p_customer_id) then
    v_is_first_order := true;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one order item';
  end if;
  if coalesce(p_discount, 0) < 0 or coalesce(p_paid_amount, 0) < 0 then
    raise exception 'Discount and payment cannot be negative';
  end if;

  insert into public.orders(order_number, invoice_number, customer_id, expected_delivery_date,
    status, subtotal, discount, total_amount, paid_amount, payment_status, notes,
    pickup_status, pickup_requested_at, idempotency_key)
  values(null, null, p_customer_id, p_expected_delivery_date, 'Pickup Requested', 0, 0, 0, 0,
    'Pending', coalesce(p_notes, ''), 'Requested', now(), p_idempotency_key)
  returning * into v_order;

  for item in select value from jsonb_array_elements(p_items) loop
    select * into svc from public.services
     where id = (item ->> 'service_id')::bigint and active and not is_deleted;
    if not found then raise exception 'One of the selected services is inactive or unavailable'; end if;
    quantity := coalesce((item ->> 'quantity')::numeric, 0);
    if quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
    insert into public.order_items(order_id, service_id, item_name, item_description,
      quantity, unit, rate, amount)
    values(v_order.id, svc.id, svc.service_name,
      nullif(btrim(item ->> 'item_description'), ''), quantity, svc.unit_type,
      svc.rate, round(quantity * svc.rate, 2));
  end loop;

  select coalesce(sum(i.amount), 0)::numeric(10,2) into v_subtotal
    from public.order_items i where i.order_id = v_order.id;
  v_manual_discount := coalesce(p_discount, 0)::numeric(10,2);
  if v_is_first_order then
    v_welcome_discount := round(v_subtotal * 0.25, 2);
  end if;
  v_total_discount := v_manual_discount + v_welcome_discount;
  if v_total_discount > v_subtotal then
    raise exception 'Combined discounts cannot exceed order subtotal';
  end if;
  total := greatest(v_subtotal - v_total_discount, 0)::numeric(10,2);
  paid := coalesce(p_paid_amount, 0)::numeric(10,2);
  if paid > total then raise exception 'Initial payment exceeds order total'; end if;
  if paid > 0 and coalesce(p_payment_method, 'Cash') not in ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Other') then
    raise exception 'Invalid payment method';
  end if;
  update public.orders set invoice_number = v_order.order_number, subtotal = v_subtotal,
    discount = v_total_discount, total_amount = total, updated_at = now()
   where id = v_order.id;
  if paid > 0 then
    insert into public.payments(order_id, amount, payment_method, idempotency_key)
    values(v_order.id, paid, coalesce(p_payment_method, 'Cash'), p_idempotency_key || ':initial-payment');
  end if;
  select * into v_order from public.orders where id = v_order.id;
  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number,
    'invoice_number', v_order.invoice_number, 'subtotal', v_order.subtotal,
    'discount', v_order.discount, 'welcome_discount', v_welcome_discount,
    'total_amount', v_order.total_amount, 'paid_amount', v_order.paid_amount,
    'payment_status', v_order.payment_status, 'status', v_order.status, 'duplicate', false);
end;
$function$;
