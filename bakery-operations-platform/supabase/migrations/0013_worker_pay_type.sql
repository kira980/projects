-- Stage 18: worker pay types for automatic salary calculation.
--
-- A worker is paid either by the hour (hours × hourly_rate) or a fixed
-- monthly salary (monthly_rate). Existing workers default to hourly,
-- which matches the current hourly_rate-based estimate.

alter table public.workers
  add column pay_type text not null default 'hourly'
    check (pay_type in ('hourly', 'monthly')),
  add column monthly_rate numeric(10, 2) check (monthly_rate >= 0);
