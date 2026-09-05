-- Feature update: drop fixed driver role, vendor categories, delivery codes.

-- Driver eligibility becomes "any active worker with a passcode" — same
-- gate as kiosk login, just a different session scope. No stored role.
alter table public.workers drop column is_driver;

-- Vendor categories.
alter table public.vendors
  add column category text check (
    category in ('חומרי גלם', 'מוצרי חלב', 'אריזות', 'ניקיון', 'שתייה', 'אחר')
  );

-- Short delivery/box codes ("A1", "B2"...), one global sequence per
-- business+delivery_date, assigned once at order creation.
create table public.delivery_code_counters (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  delivery_date date not null,
  next_seq      int not null default 1,
  primary key (business_id, delivery_date)
);

alter table public.delivery_code_counters enable row level security;
create policy "business members full access"
  on public.delivery_code_counters for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create or replace function public.take_delivery_code_seq(
  p_business_id uuid,
  p_delivery_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into delivery_code_counters (business_id, delivery_date, next_seq)
  values (p_business_id, p_delivery_date, 2)
  on conflict (business_id, delivery_date)
    do update set next_seq = delivery_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;
  return v_seq;
end;
$$;

alter table public.orders add column delivery_code text;
