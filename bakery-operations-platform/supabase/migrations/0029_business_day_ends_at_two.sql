-- Stage 29: the money business day ends at 02:00, not 04:00.
--
-- The old 04:00 boundary sat in the middle of the morning crew's clock-in
-- rush (39 clock-ins in hour 04, 14 in hour 03), so every baker who
-- started before 04:00 was filed under the previous day — and a worker
-- could show up twice on one day with 24 hours between them.
--
-- 02:00 is the one quiet moment in this bakery's clock: the night crew's
-- last clock-out lands by 01:21 and the morning crew's first clock-in is
-- 02:55, so nothing is cut in half. It also keeps a trading night whole —
-- the register counted at 01:10 still closes the night that traded.
--
-- These two functions decide which day a financial write is checked
-- against, so they must agree with BUSINESS_DAY_START_HOUR in
-- lib/db/day-lock.ts. Nothing in the data moves: no advance, arrival or
-- payment has ever been recorded between 02:00 and 04:00.
--
-- Shifts are NOT governed by this. A shift belongs to the day it started
-- unless it started at 21:00 or later, in which case it is the next day's
-- work — see shiftDayOf() in lib/db/day-lock.ts. That rule lives only in
-- the app, because no database function files shifts.

create or replace function public.business_today()
returns date
language sql
stable
set search_path = public
as $$
  select ((now() at time zone 'Asia/Jerusalem') - interval '2 hours')::date
$$;

create or replace function public.business_day_of(p_at timestamptz)
returns date
language sql
stable
set search_path = public
as $$
  select ((p_at at time zone 'Asia/Jerusalem') - interval '2 hours')::date
$$;

notify pgrst, 'reload schema';
