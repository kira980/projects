-- Brute-force protection for passcode logins (kiosk / production / driver).
-- 4-digit passcodes are only ~10k combinations, and each attempt is compared
-- against every worker's hash — so unlimited attempts are both guessable and
-- a CPU DoS. This table tracks failed attempts per client IP + scope and
-- locks that IP out after too many failures.
--
-- Written only by the server (service-role client), so RLS is enabled with
-- NO policies: anon/authenticated get zero access.

create table if not exists public.auth_throttle (
  ip           text        not null,
  scope        text        not null,
  failed_count integer     not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (ip, scope)
);

alter table public.auth_throttle enable row level security;
