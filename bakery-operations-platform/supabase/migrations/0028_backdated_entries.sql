-- Stage 28: entries that belong to a day that has already passed.
--
-- Goods arrivals were always stamped `now()`: whatever the kiosk or the
-- dashboard recorded landed on today, so an arrival nobody got round to
-- entering that night could never be put on the right day. The arrival
-- time is now a parameter, and the day lock that guards the write is the
-- lock of the day the arrival is DATED TO — not today's. Back-dating into
-- a locked day stays refused, exactly as expenses already behave.
--
-- The two functions change signature (a trailing p_received_at), so they
-- are dropped first: `create or replace` with an extra argument would add
-- an overload and leave PostgREST unable to choose between them.

-- The business day an instant belongs to — the SQL twin of businessDayOf()
-- in lib/db/day-lock.ts (Israel time, rolling over at 04:00).
create or replace function public.business_day_of(p_at timestamptz)
returns date
language sql
stable
set search_path = public
as $$
  select ((p_at at time zone 'Asia/Jerusalem') - interval '4 hours')::date
$$;

-- The guard now takes the day being written to. Omitted (every caller that
-- writes "now") it still means today, so the existing calls in 0026 keep
-- working through the default.
drop function if exists public.assert_vendor_write_allowed(uuid);

create or replace function public.assert_vendor_write_allowed(
  p_business_id uuid,
  p_day         date default null
)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_caller uuid := public.current_business_id();
  v_day    date := coalesce(p_day, public.business_today());
begin
  if p_business_id is null then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_caller is not null and v_caller <> p_business_id then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if exists (
    select 1 from day_locks
    where business_id = p_business_id
      and lock_date = v_day
      and is_locked
  ) then
    raise exception 'DAY_LOCKED';
  end if;
end;
$$;

-- ── קבלת סחורה, on a chosen date ────────────────────────────────────────

drop function if exists public.record_vendor_order(
  uuid, uuid, numeric, boolean, text, uuid, text, uuid, text, text,
  text, uuid, text
);

create or replace function public.record_vendor_order(
  p_business_id       uuid,
  p_vendor_id         uuid,
  p_amount            numeric,
  p_paid              boolean,
  p_payment_method    text,
  p_paid_by_worker_id uuid,
  p_received_by_type  text,
  p_received_by_id    uuid,
  p_receipt_file_path text,
  p_notes             text,
  p_actor_type        text,
  p_actor_id          uuid,
  p_actor_name        text,
  p_received_at       timestamptz default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_order_id   uuid;
  v_payment_id uuid;
  v_at         timestamptz := coalesce(p_received_at, now());
begin
  perform public.assert_vendor_write_allowed(
    p_business_id, public.business_day_of(v_at)
  );

  if not exists (
    select 1 from vendors
    where id = p_vendor_id and business_id = p_business_id
  ) then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  insert into vendor_orders (
    business_id, vendor_id, amount, status, payment_method,
    paid_by_worker_id, received_by_type, received_by_id,
    receipt_file_path, notes, received_at
  ) values (
    p_business_id, p_vendor_id, p_amount,
    case when p_paid then 'paid' else 'unpaid' end,
    case when p_paid then p_payment_method end,
    case when p_paid then p_paid_by_worker_id end,
    p_received_by_type, p_received_by_id,
    p_receipt_file_path, p_notes, v_at
  )
  returning id into v_order_id;

  -- The bill itself.
  insert into vendor_ledger_entries (
    business_id, vendor_id, entry_type, amount, vendor_order_id, description
  ) values (
    p_business_id, p_vendor_id, 'charge', p_amount, v_order_id, 'קבלת סחורה'
  );

  if p_paid then
    -- Money handed over at the arrival is dated with the arrival, so a
    -- back-dated bill lands in that day's payments too.
    insert into vendor_payments (
      business_id, vendor_id, vendor_order_id, amount, method,
      paid_by_type, paid_by_id, at_arrival, paid_at
    ) values (
      p_business_id, p_vendor_id, v_order_id, p_amount,
      coalesce(p_payment_method, 'cash'), p_received_by_type,
      coalesce(p_paid_by_worker_id, p_received_by_id), true, v_at
    )
    returning id into v_payment_id;

    insert into vendor_ledger_entries (
      business_id, vendor_id, entry_type, amount,
      vendor_order_id, vendor_payment_id, description
    ) values (
      p_business_id, p_vendor_id, 'payment', p_amount,
      v_order_id, v_payment_id, 'תשלום בעת קבלת סחורה'
    );
  end if;

  insert into audit_logs (
    business_id, actor_type, actor_id, actor_name,
    action, entity_type, entity_id, details
  ) values (
    p_business_id, p_actor_type, p_actor_id, p_actor_name,
    'vendor_order.create', 'vendor_order', v_order_id,
    jsonb_build_object(
      'vendor_id', p_vendor_id,
      'amount', p_amount,
      'paid', p_paid,
      'method', case when p_paid then p_payment_method end,
      'received_at', v_at
    )
  );

  return v_order_id;
end;
$$;

/*
 * Full edit of a goods arrival — as in 0026, plus the arrival time itself.
 * A null p_received_at keeps the date the arrival already has.
 *
 * Moving an arrival between days touches two days' books, so BOTH have to
 * be open: the day it sits on now and the day it is moving to.
 */
drop function if exists public.update_vendor_order(
  uuid, uuid, uuid, numeric, boolean, text, uuid, text, text,
  text, uuid, text
);

create or replace function public.update_vendor_order(
  p_business_id       uuid,
  p_order_id          uuid,
  p_vendor_id         uuid,
  p_amount            numeric,
  p_paid              boolean,
  p_payment_method    text,
  p_paid_by_worker_id uuid,
  p_receipt_file_path text,
  p_notes             text,
  p_actor_type        text,
  p_actor_id          uuid,
  p_actor_name        text,
  p_received_at       timestamptz default null
)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_order        vendor_orders%rowtype;
  v_payment_id   uuid;
  v_settled_late boolean;
  v_at           timestamptz;
begin
  select * into v_order
  from vendor_orders
  where id = p_order_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_at := coalesce(p_received_at, v_order.received_at);

  perform public.assert_vendor_write_allowed(
    p_business_id, public.business_day_of(v_order.received_at)
  );
  if public.business_day_of(v_at)
     is distinct from public.business_day_of(v_order.received_at) then
    perform public.assert_vendor_write_allowed(
      p_business_id, public.business_day_of(v_at)
    );
  end if;

  if not exists (
    select 1 from vendors
    where id = p_vendor_id and business_id = p_business_id
  ) then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  -- Cash paid against this bill on a later occasion is its own record.
  -- Un-paying the bill or moving it to another vendor would silently
  -- rewrite that payment, so those edits are refused until it is undone.
  v_settled_late := exists (
    select 1 from vendor_payments
    where business_id = p_business_id
      and vendor_order_id = v_order.id
      and not at_arrival
  );
  if v_settled_late
     and (not p_paid or p_vendor_id is distinct from v_order.vendor_id) then
    raise exception 'DEBT_PAYMENT_EXISTS';
  end if;

  update vendor_orders
  set vendor_id         = p_vendor_id,
      amount            = p_amount,
      status            = case when p_paid then 'paid' else 'unpaid' end,
      payment_method    = case when p_paid then p_payment_method end,
      paid_by_worker_id = case when p_paid then p_paid_by_worker_id end,
      receipt_file_path = coalesce(p_receipt_file_path, receipt_file_path),
      notes             = p_notes,
      received_at       = v_at
  where id = v_order.id;

  -- The charge row (insert it if this bill predates the ledger).
  update vendor_ledger_entries
  set amount = p_amount, vendor_id = p_vendor_id
  where business_id = p_business_id
    and vendor_order_id = v_order.id
    and entry_type = 'charge';
  if not found then
    insert into vendor_ledger_entries (
      business_id, vendor_id, entry_type, amount, vendor_order_id, description
    ) values (
      p_business_id, p_vendor_id, 'charge', p_amount, v_order.id, 'קבלת סחורה'
    );
  end if;

  select id into v_payment_id
  from vendor_payments
  where business_id = p_business_id
    and vendor_order_id = v_order.id
    and at_arrival
  order by paid_at
  limit 1;

  if p_paid and v_payment_id is not null then
    update vendor_payments
    set vendor_id  = p_vendor_id,
        amount     = p_amount,
        method     = coalesce(p_payment_method, method),
        paid_by_id = coalesce(p_paid_by_worker_id, paid_by_id),
        paid_at    = v_at
    where id = v_payment_id;

    update vendor_ledger_entries
    set amount = p_amount, vendor_id = p_vendor_id
    where business_id = p_business_id and vendor_payment_id = v_payment_id;

  elsif p_paid and not v_settled_late then
    -- Marked paid after the fact: book the arrival payment now.
    insert into vendor_payments (
      business_id, vendor_id, vendor_order_id, amount, method,
      paid_by_type, paid_by_id, at_arrival, paid_at
    ) values (
      p_business_id, p_vendor_id, v_order.id, p_amount,
      coalesce(p_payment_method, 'cash'), v_order.received_by_type,
      coalesce(p_paid_by_worker_id, v_order.received_by_id), true, v_at
    )
    returning id into v_payment_id;

    insert into vendor_ledger_entries (
      business_id, vendor_id, entry_type, amount,
      vendor_order_id, vendor_payment_id, description
    ) values (
      p_business_id, p_vendor_id, 'payment', p_amount,
      v_order.id, v_payment_id, 'תשלום בעת קבלת סחורה'
    );

  elsif not p_paid and v_payment_id is not null then
    -- Turned back into a debt: drop the arrival payment and its ledger
    -- row. A later debt payment was ruled out above.
    delete from vendor_ledger_entries
    where business_id = p_business_id and vendor_payment_id = v_payment_id;
    delete from vendor_payments where id = v_payment_id;
  end if;
  -- p_paid with a later debt payment already covering the bill: nothing
  -- to write, that payment stands on its own.

  insert into audit_logs (
    business_id, actor_type, actor_id, actor_name,
    action, entity_type, entity_id, details
  ) values (
    p_business_id, p_actor_type, p_actor_id, p_actor_name,
    'vendor_order.update', 'vendor_order', v_order.id,
    jsonb_build_object(
      'from', jsonb_build_object(
        'vendor_id', v_order.vendor_id,
        'amount', v_order.amount,
        'paid', v_order.status = 'paid',
        'method', v_order.payment_method,
        'received_at', v_order.received_at
      ),
      'to', jsonb_build_object(
        'vendor_id', p_vendor_id,
        'amount', p_amount,
        'paid', p_paid,
        'method', case when p_paid then p_payment_method end,
        'received_at', v_at
      )
    )
  );
end;
$$;

/*
 * Deleting an arrival is unwinding that day's books, so it obeys the lock
 * of the day the arrival sits on rather than today's — a day nobody has
 * locked yet stays fixable, a closed one does not.
 */
create or replace function public.delete_vendor_order(
  p_business_id uuid,
  p_order_id    uuid,
  p_actor_type  text,
  p_actor_id    uuid,
  p_actor_name  text
)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_order vendor_orders%rowtype;
begin
  select * into v_order
  from vendor_orders
  where id = p_order_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  perform public.assert_vendor_write_allowed(
    p_business_id, public.business_day_of(v_order.received_at)
  );

  -- Deleting the bill would take a later debt payment with it — real
  -- cash, recorded on its own occasion. Undo that payment first.
  if exists (
    select 1 from vendor_payments
    where business_id = p_business_id
      and vendor_order_id = v_order.id
      and not at_arrival
  ) then
    raise exception 'DEBT_PAYMENT_EXISTS';
  end if;

  -- Everything hanging off this bill: its ledger rows and the payment
  -- handed over at the arrival, then the bill.
  delete from vendor_ledger_entries
  where business_id = p_business_id and vendor_order_id = v_order.id;
  delete from vendor_payments
  where business_id = p_business_id and vendor_order_id = v_order.id;
  delete from vendor_orders where id = v_order.id;

  insert into audit_logs (
    business_id, actor_type, actor_id, actor_name,
    action, entity_type, entity_id, details
  ) values (
    p_business_id, p_actor_type, p_actor_id, p_actor_name,
    'vendor_order.delete', 'vendor_order', v_order.id,
    jsonb_build_object('vendor_id', v_order.vendor_id, 'amount', v_order.amount)
  );
end;
$$;

notify pgrst, 'reload schema';
