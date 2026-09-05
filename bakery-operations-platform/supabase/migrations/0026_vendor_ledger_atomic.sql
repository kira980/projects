-- Stage 26: atomic vendor bills, payments and corrections.
--
-- Vendor debt is defined ONLY as sum(charge) - sum(payment) over
-- vendor_ledger_entries (see the vendor_debts view in 0005). The app used
-- to write the bill/payment row and its ledger row(s) as separate calls,
-- discarding the ledger call's error — so a failure between them silently
-- mis-stated the debt with no way to reconstruct it from app data.
--
-- Every vendor write now goes through one of these functions: one round
-- trip, one transaction, all-or-nothing.
--
-- SECURITY: security invoker, so RLS applies exactly as it did to the
-- app-side queries. Both callers are server-only — the dashboard passes
-- an authenticated (RLS) client, the worker kiosk a service-role client.
-- The business id is a parameter because the kiosk has no JWT; when the
-- caller DOES have one it must match, so an authenticated user can never
-- reach another business.

-- Money handed over at the arrival itself, as opposed to a debt payment
-- made later against the same bill. Editing or deleting an arrival may
-- rewrite the former (it is part of the arrival) but must never touch the
-- latter — that is cash someone paid on a separate occasion.
alter table public.vendor_payments
  add column if not exists at_arrival boolean not null default false;

update public.vendor_payments p
set at_arrival = true
where not p.at_arrival
  and exists (
    select 1 from public.vendor_ledger_entries e
    where e.vendor_payment_id = p.id
      and e.description = 'תשלום בעת קבלת סחורה'
  );

-- Business day, matching lib/db/day-lock.ts: Israel time, rolling over at
-- 04:00 rather than midnight (the bakery closes ~01:00–02:00).
create or replace function public.business_today()
returns date
language sql
stable
set search_path = public
as $$
  select ((now() at time zone 'Asia/Jerusalem') - interval '4 hours')::date
$$;

-- Shared guard for every financial vendor write.
create or replace function public.assert_vendor_write_allowed(p_business_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_caller uuid := public.current_business_id();
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
      and lock_date = public.business_today()
      and is_locked
  ) then
    raise exception 'DAY_LOCKED';
  end if;
end;
$$;

-- Current debt for a vendor, optionally ignoring one payment's own ledger
-- rows (used when re-checking the cap while editing that payment).
create or replace function public.vendor_debt_for(
  p_business_id       uuid,
  p_vendor_id         uuid,
  p_exclude_payment   uuid default null
)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(round(sum(
    case entry_type when 'payment' then -amount else amount end
  ), 2), 0)
  from vendor_ledger_entries
  where business_id = p_business_id
    and vendor_id = p_vendor_id
    and (p_exclude_payment is null or vendor_payment_id is distinct from p_exclude_payment)
$$;

/*
 * Reject paying a vendor more than it is owed.
 *
 * Only vendors we actually bill are capped. A vendor with no 'charge'
 * entry is one whose bills we don't track — the kiosk's "ספק אחר" flow
 * creates the vendor row at payment time — and there is nothing to
 * compare against, so those stay uncapped. The current debt travels in
 * the error message so the UI can show it.
 */
create or replace function public.assert_vendor_payment_within_debt(
  p_business_id     uuid,
  p_vendor_id       uuid,
  p_amount          numeric,
  p_exclude_payment uuid default null
)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_debt numeric;
begin
  if not exists (
    select 1 from vendor_ledger_entries
    where business_id = p_business_id
      and vendor_id = p_vendor_id
      and entry_type = 'charge'
  ) then
    return;
  end if;

  v_debt := public.vendor_debt_for(p_business_id, p_vendor_id, p_exclude_payment);
  if round(p_amount, 2) > v_debt then
    raise exception 'DEBT_EXCEEDED:%', to_char(v_debt, 'FM999999990.00');
  end if;
end;
$$;

-- ── קבלת סחורה ──────────────────────────────────────────────────────────

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
  p_actor_name        text
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
begin
  perform public.assert_vendor_write_allowed(p_business_id);

  if not exists (
    select 1 from vendors
    where id = p_vendor_id and business_id = p_business_id
  ) then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  insert into vendor_orders (
    business_id, vendor_id, amount, status, payment_method,
    paid_by_worker_id, received_by_type, received_by_id,
    receipt_file_path, notes
  ) values (
    p_business_id, p_vendor_id, p_amount,
    case when p_paid then 'paid' else 'unpaid' end,
    case when p_paid then p_payment_method end,
    case when p_paid then p_paid_by_worker_id end,
    p_received_by_type, p_received_by_id,
    p_receipt_file_path, p_notes
  )
  returning id into v_order_id;

  -- The bill itself.
  insert into vendor_ledger_entries (
    business_id, vendor_id, entry_type, amount, vendor_order_id, description
  ) values (
    p_business_id, p_vendor_id, 'charge', p_amount, v_order_id, 'קבלת סחורה'
  );

  if p_paid then
    insert into vendor_payments (
      business_id, vendor_id, vendor_order_id, amount, method,
      paid_by_type, paid_by_id, at_arrival
    ) values (
      p_business_id, p_vendor_id, v_order_id, p_amount,
      coalesce(p_payment_method, 'cash'), p_received_by_type,
      coalesce(p_paid_by_worker_id, p_received_by_id), true
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
      'method', case when p_paid then p_payment_method end
    )
  );

  return v_order_id;
end;
$$;

/*
 * Full edit of a goods arrival — the same fields the arrival screen
 * offers, so a worker can fix any of them, not just the amount.
 *
 * The ledger is kept in step: the charge row follows the vendor and the
 * amount, and the arrival-time payment is created, updated or removed as
 * the paid flag moves. p_receipt_file_path null means "keep the current
 * photo" (the form only sends a path when a new one was uploaded).
 */
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
  p_actor_name        text
)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_order       vendor_orders%rowtype;
  v_payment_id  uuid;
  v_settled_late boolean;
begin
  perform public.assert_vendor_write_allowed(p_business_id);

  select * into v_order
  from vendor_orders
  where id = p_order_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
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
      notes             = p_notes
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
        paid_by_id = coalesce(p_paid_by_worker_id, paid_by_id)
    where id = v_payment_id;

    update vendor_ledger_entries
    set amount = p_amount, vendor_id = p_vendor_id
    where business_id = p_business_id and vendor_payment_id = v_payment_id;

  elsif p_paid and not v_settled_late then
    -- Marked paid after the fact: book the arrival payment now.
    insert into vendor_payments (
      business_id, vendor_id, vendor_order_id, amount, method,
      paid_by_type, paid_by_id, at_arrival
    ) values (
      p_business_id, p_vendor_id, v_order.id, p_amount,
      coalesce(p_payment_method, 'cash'), v_order.received_by_type,
      coalesce(p_paid_by_worker_id, v_order.received_by_id), true
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
        'method', v_order.payment_method
      ),
      'to', jsonb_build_object(
        'vendor_id', p_vendor_id,
        'amount', p_amount,
        'paid', p_paid,
        'method', case when p_paid then p_payment_method end
      )
    )
  );
end;
$$;

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
  perform public.assert_vendor_write_allowed(p_business_id);

  select * into v_order
  from vendor_orders
  where id = p_order_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

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

-- ── תשלום חוב לספק ──────────────────────────────────────────────────────

create or replace function public.record_vendor_payment(
  p_business_id     uuid,
  p_vendor_id       uuid,
  p_vendor_order_id uuid,
  p_amount          numeric,
  p_method          text,
  p_paid_by_type    text,
  p_paid_by_id      uuid,
  p_proof_file_path text,
  p_notes           text,
  p_actor_type      text,
  p_actor_id        uuid,
  p_actor_name      text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_payment_id uuid;
begin
  perform public.assert_vendor_write_allowed(p_business_id);

  if not exists (
    select 1 from vendors
    where id = p_vendor_id and business_id = p_business_id
  ) then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  if p_vendor_order_id is not null and not exists (
    select 1 from vendor_orders
    where id = p_vendor_order_id and business_id = p_business_id
  ) then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  perform public.assert_vendor_payment_within_debt(
    p_business_id, p_vendor_id, p_amount
  );

  insert into vendor_payments (
    business_id, vendor_id, vendor_order_id, amount, method,
    paid_by_type, paid_by_id, proof_file_path, notes
  ) values (
    p_business_id, p_vendor_id, p_vendor_order_id, p_amount, p_method,
    p_paid_by_type, p_paid_by_id, p_proof_file_path, p_notes
  )
  returning id into v_payment_id;

  insert into vendor_ledger_entries (
    business_id, vendor_id, entry_type, amount,
    vendor_order_id, vendor_payment_id, description
  ) values (
    p_business_id, p_vendor_id, 'payment', p_amount,
    p_vendor_order_id, v_payment_id,
    case when p_vendor_order_id is not null
      then 'תשלום חשבונית' else 'תשלום על חשבון חוב' end
  );

  if p_vendor_order_id is not null then
    update vendor_orders
    set status = 'paid', payment_method = p_method
    where id = p_vendor_order_id and business_id = p_business_id;
  end if;

  insert into audit_logs (
    business_id, actor_type, actor_id, actor_name,
    action, entity_type, entity_id, details
  ) values (
    p_business_id, p_actor_type, p_actor_id, p_actor_name,
    'vendor_payment.create', 'vendor_payment', v_payment_id,
    jsonb_build_object(
      'vendor_id', p_vendor_id,
      'amount', p_amount,
      'method', p_method,
      'vendor_order_id', p_vendor_order_id
    )
  );

  return v_payment_id;
end;
$$;

/*
 * Full edit of a debt payment — vendor, which invoice (if any), amount,
 * method, who paid, proof and note. Moving the payment off an invoice
 * puts that invoice back to unpaid; moving it onto one marks it paid.
 * The cap is re-checked against the debt excluding this payment, so
 * raising an amount can never push the vendor into credit.
 */
create or replace function public.update_vendor_payment(
  p_business_id     uuid,
  p_payment_id      uuid,
  p_vendor_id       uuid,
  p_vendor_order_id uuid,
  p_amount          numeric,
  p_method          text,
  p_paid_by_id      uuid,
  p_proof_file_path text,
  p_notes           text,
  p_actor_type      text,
  p_actor_id        uuid,
  p_actor_name      text
)
returns void
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_payment vendor_payments%rowtype;
begin
  perform public.assert_vendor_write_allowed(p_business_id);

  select * into v_payment
  from vendor_payments
  where id = p_payment_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if not exists (
    select 1 from vendors
    where id = p_vendor_id and business_id = p_business_id
  ) then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  if p_vendor_order_id is not null and not exists (
    select 1 from vendor_orders
    where id = p_vendor_order_id and business_id = p_business_id
  ) then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  perform public.assert_vendor_payment_within_debt(
    p_business_id, p_vendor_id, p_amount, v_payment.id
  );

  update vendor_payments
  set vendor_id       = p_vendor_id,
      vendor_order_id = p_vendor_order_id,
      amount          = p_amount,
      method          = p_method,
      paid_by_id      = coalesce(p_paid_by_id, paid_by_id),
      proof_file_path = coalesce(p_proof_file_path, proof_file_path),
      notes           = p_notes
  where id = v_payment.id;

  update vendor_ledger_entries
  set vendor_id       = p_vendor_id,
      amount          = p_amount,
      vendor_order_id = p_vendor_order_id,
      description     = case when p_vendor_order_id is not null
                          then 'תשלום חשבונית' else 'תשלום על חשבון חוב' end
  where business_id = p_business_id and vendor_payment_id = v_payment.id;

  -- An invoice this payment no longer covers goes back to unpaid.
  if v_payment.vendor_order_id is not null
     and v_payment.vendor_order_id is distinct from p_vendor_order_id then
    update vendor_orders
    set status = 'unpaid', payment_method = null, paid_by_worker_id = null
    where id = v_payment.vendor_order_id and business_id = p_business_id;
  end if;
  if p_vendor_order_id is not null then
    update vendor_orders
    set status = 'paid', payment_method = p_method
    where id = p_vendor_order_id and business_id = p_business_id;
  end if;

  insert into audit_logs (
    business_id, actor_type, actor_id, actor_name,
    action, entity_type, entity_id, details
  ) values (
    p_business_id, p_actor_type, p_actor_id, p_actor_name,
    'vendor_payment.update', 'vendor_payment', v_payment.id,
    jsonb_build_object(
      'from', jsonb_build_object(
        'vendor_id', v_payment.vendor_id,
        'amount', v_payment.amount,
        'method', v_payment.method,
        'vendor_order_id', v_payment.vendor_order_id
      ),
      'to', jsonb_build_object(
        'vendor_id', p_vendor_id,
        'amount', p_amount,
        'method', p_method,
        'vendor_order_id', p_vendor_order_id
      )
    )
  );
end;
$$;

create or replace function public.delete_vendor_payment(
  p_business_id uuid,
  p_payment_id  uuid,
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
  v_payment vendor_payments%rowtype;
begin
  perform public.assert_vendor_write_allowed(p_business_id);

  select * into v_payment
  from vendor_payments
  where id = p_payment_id and business_id = p_business_id
  for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  delete from vendor_ledger_entries
  where business_id = p_business_id and vendor_payment_id = v_payment.id;
  delete from vendor_payments where id = v_payment.id;

  -- The invoice it covered goes back to unpaid.
  if v_payment.vendor_order_id is not null then
    update vendor_orders
    set status = 'unpaid', payment_method = null, paid_by_worker_id = null
    where id = v_payment.vendor_order_id and business_id = p_business_id;
  end if;

  insert into audit_logs (
    business_id, actor_type, actor_id, actor_name,
    action, entity_type, entity_id, details
  ) values (
    p_business_id, p_actor_type, p_actor_id, p_actor_name,
    'vendor_payment.delete', 'vendor_payment', v_payment.id,
    jsonb_build_object('vendor_id', v_payment.vendor_id, 'amount', v_payment.amount)
  );
end;
$$;

notify pgrst, 'reload schema';
