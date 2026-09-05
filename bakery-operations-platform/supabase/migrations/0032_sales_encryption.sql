-- Stage 32: the day's takings, encrypted so only the owner can read them.
--
-- מזומן / ויזה / אחר used to sit in plain columns, which meant anyone with
-- database access — a dump, a backup, a leaked service key, whoever
-- administers the project — could read the shop's revenue. They are now
-- encrypted in the OWNER'S BROWSER and stored as opaque text. No key ever
-- reaches this server, so there is nothing here to decrypt them with.
--
-- Envelope scheme, so a passphrase change never touches the data:
--
--   passphrase --PBKDF2--> key-encryption key --unwraps--> data key
--   data key --AES-256-GCM--> every day's {cash, card, other}
--
-- The data key is random and is only ever stored wrapped. Wrapping it a
-- second time under a recovery code is how a recovery code gets added
-- later, without re-encrypting anything.
--
-- What this does NOT hide, deliberately: which days have an entry, when
-- they were written, and נשאר בקופה — the shift manager records that from
-- the kiosk and has no passphrase, so it stays readable.

create table public.sales_encryption (
  business_id          uuid primary key references public.businesses (id) on delete cascade,
  -- PBKDF2 parameters for the passphrase. Neither is secret.
  salt                 text not null,
  iterations           integer not null default 600000 check (iterations >= 100000),
  -- The data key, wrapped under the passphrase (base64 of iv || ciphertext).
  -- Unwrapping is also the password check: AES-GCM fails on a wrong key.
  wrapped_key          text not null,
  -- The same data key wrapped under a recovery code. Null until the owner
  -- chooses to set one.
  recovery_salt        text,
  recovery_wrapped_key text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger sales_encryption_set_updated_at
  before update on public.sales_encryption
  for each row execute function public.set_updated_at();

alter table public.sales_encryption enable row level security;
create policy "business members full access"
  on public.sales_encryption for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- base64 of iv || AES-256-GCM({"cash":n,"card":n,"other":n}), padded so the
-- length of the ciphertext says nothing about the size of the numbers.
alter table public.daily_sales
  add column if not exists sales_cipher text;

comment on column public.daily_sales.sales_cipher is
  'Owner-encrypted takings. Written only by /secret; the server cannot read it.';

-- The old plaintext columns stay for the history already recorded, which
-- the owner has accepted as exposed. Nothing writes them from here on:
-- the dashboard no longer collects or displays takings at all.
comment on column public.daily_sales.cash_total is
  'Legacy plaintext takings, frozen. New entries go to sales_cipher.';

notify pgrst, 'reload schema';
