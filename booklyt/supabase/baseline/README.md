# Consolidated baseline

| File | What it does | When |
|---|---|---|
| `00000000000000_teardown.sql` | Wipes an existing project back to empty | Only when reusing the same project ref |
| `00000000000000_baseline.sql` | Builds the whole schema + storage from nothing | Always |
| `00000000000001_seed.sql` | Loads the current live project's data into it | Always |

## Which path to take

**Preferred — new project.** Create a fresh Supabase project, run `baseline` then
`seed`, point the app at it, verify, and keep the old project as a rollback. No
teardown needed and nothing is at risk.

**Only if you must reuse the same project ref** (it is wired into deploys, a
custom domain, or the mobile apps): run `teardown` first.

The teardown ships **disarmed** — a `SAFETY STOP` block at the top raises
`P0001` until you delete it. That error is the guard doing its job, not a
failure. Delete the `do $$ ... end $$;` block to arm it.

It also drops named objects rather than running `drop schema public cascade`,
because Supabase's own `public.rls_auto_enable()` lives in that schema and backs
the `ensure_rls` event trigger; nuking the schema breaks new-table RLS
enforcement project-wide.

### Backups on the free tier

Dashboard backups and PITR are paid features. You do not need them here:
`00000000000001_seed.sql` already contains every application row from the
project, verified table by table, so the teardown destroys nothing the seed
cannot put back.

The single exception is auth passwords — bcrypt hashes are deliberately kept out
of the seed. That is why **Section 3 of the teardown (`delete from auth.users`)
is commented out by default**. Leave it that way and no login is ever at risk;
you still get a completely clean schema, because every table referencing
`auth.users` is dropped and rebuilt regardless.

The seed's Section 1 is safe to run either way: its inserts are `ON CONFLICT DO
NOTHING` and `auth.identities` has a `UNIQUE (provider_id, provider)` constraint,
so existing users are skipped — passwords untouched, no duplicate identity rows.

`00000000000000_baseline.sql` builds the entire Booklyt database and storage layer
from nothing — extensions, 22 tables, 34 foreign keys, 18 check constraints,
38 indexes, 5 functions, 2 triggers, 33 RLS policies, grants, and the
`business-media` storage bucket. It replaces all 49 files in `../migrations`.

It lives here rather than in `../migrations` on purpose: dropping it there
alongside the existing 49 files would apply the schema twice.

## Use it on a brand-new project

```bash
supabase link --project-ref <NEW_REF>
psql "$DATABASE_URL" -f supabase/baseline/00000000000000_baseline.sql
psql "$DATABASE_URL" -f supabase/baseline/00000000000001_seed.sql
```

Or paste them into the SQL editor in that order. Both are fully idempotent —
re-running changes nothing.

## The seed

`00000000000001_seed.sql` carries the live project's data across with every
primary key preserved, so foreign keys, `manage_token`s and the published builder
config all line up exactly as they do today: 6 auth users, 1 profile, 1 business,
1 service, 7 working-hour rows, 1 appointment, 2 appointment events, 1 builder
config, 1 WhatsApp log row.

Three things worth knowing before running it:

- **Passwords are not migrated.** Section 1 sets one shared temporary password
  (edit `v_temp_password` at the top) and everyone should use "forgot password"
  afterwards. Bcrypt hashes are copyable but do not belong in a git-tracked file;
  the file explains how to move them DB-to-DB instead if you prefer.
- **It contains personal data** — six real email addresses and a customer phone
  number. Keep it out of any public repository.
- **`content.heroImage` is deliberately stripped.** On the source project it still
  holds a `blob:` URL from the failed-upload bug, which resolves only inside the
  tab that created it. Seeding it forward would recreate a broken hero image on
  day one. Re-upload the photo from the builder once the new project is up.

## Use it to squash the repo

```bash
mkdir -p supabase/migrations/_archive
git mv supabase/migrations/*.sql supabase/migrations/_archive/
git mv supabase/baseline/00000000000000_baseline.sql supabase/migrations/
```

Then tell the live project this baseline is already applied, so `db push`
does not try to re-run it:

```bash
supabase migration repair --status applied 00000000000000
```

## How it was built

Reconciled against two sources of truth that had drifted apart:

- the **live project** (`xvmudfouyqywpqtcilvp`), which is what actually runs
- the **49 migration files**, only 7 of which were ever recorded as applied

Verified: tables, columns, foreign keys (including on-delete actions), check
constraints and RLS policy names all match the live database exactly.

Six objects the repo declared but the live database never received are included
and marked `DRIFT` inline:

| Object | Kind |
|---|---|
| `business-media` bucket + `storage.objects` policies | storage |
| `idx_phone_otps_phone` | index |
| `appointment_events_business_created_idx` | index |
| `waitlist_entries_business_status_idx` | index |
| `working_hour_breaks_business_day_idx` | index |
| `idx_wa_message_log_type` | index |
| `cleanup_expired_otps()` | function |
| `handle_new_user()` + `on_auth_user_created` | function + trigger |

One object is **deliberately omitted**: `push_subscriptions_endpoint_appt_idx`.
`/api/push/subscribe` was rewritten to delete-then-insert specifically so it would
not depend on a partial unique index for upsert conflict resolution.

## Two things the file does not change

- **Tables with RLS enabled and no policies** (`customer_sessions`, `phone_otps`,
  `push_subscriptions`, `wa_message_log`, and others) are intentional deny-all.
  They are reached only through service-role API routes; a public key must never
  read customer sessions, OTP codes or push tokens. Supabase's linter flags these
  as INFO — that is expected, not a finding.
- **`auth` schema config** (leaked-password protection, etc.) is dashboard state,
  not SQL, so it is not captured here.
