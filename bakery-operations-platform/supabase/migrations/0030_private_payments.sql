-- Stage 30: the owner's private payments.
--
-- Money the owner pays out of his own pocket and wants a record of —
-- who it went to, when, how much, and why. Deliberately NOT part of the
-- business books: it never reaches מבט יומי, the daily totals, the
-- reports or the vendor and worker ledgers. It is a private notebook that
-- happens to live in the app.
--
-- Because of that it is also not governed by the day lock: locking a day
-- closes the bakery's books, and these entries were never in them.
--
-- Reachable only from the dashboard, which is admin-only (requireAdmin).
-- Workers have no route to it, and the kiosk's service-role client never
-- touches this table.

create table public.private_payments (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  amount       numeric(12, 2) not null check (amount > 0),
  paid_to      text not null,
  paid_on      date not null default (now() at time zone 'Asia/Jerusalem')::date,
  notes        text,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index private_payments_business_id_idx
  on public.private_payments (business_id);
create index private_payments_date_idx
  on public.private_payments (business_id, paid_on desc);

create trigger private_payments_set_updated_at
  before update on public.private_payments
  for each row execute function public.set_updated_at();

alter table public.private_payments enable row level security;
create policy "business members full access"
  on public.private_payments for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

notify pgrst, 'reload schema';
