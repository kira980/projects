<div align="center">

# Booklyt

**Appointment booking, as a product — not a form.**

Barbershops, salons, clinics and studios get a branded booking website, a native
mobile app, and a business dashboard. They build all of it themselves, in a
visual editor, in about five minutes.

![Status](https://img.shields.io/badge/status-pilot%20validated%20·%20production%20launch%20imminent-2ea44f?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15-000?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e?style=flat-square&logo=supabase)
![Capacitor](https://img.shields.io/badge/Capacitor-iOS%20%2B%20Android-119eff?style=flat-square&logo=capacitor)

</div>

---

## Project status

Booklyt has been **trialled with real businesses taking real bookings from real
customers**, and the pilot was a success: shops ran their day-to-day scheduling
on it, customers booked, rescheduled and cancelled themselves, and reminders
went out automatically. That trial is what shaped the product — capacity rules,
per-day breaks, the waitlist and the no-account booking link all came out of
watching actual shops use it.

The platform is now in the **final stages of going to production**, with the
remaining work in rollout and operations rather than in the product itself.

> **About this repository.** This is the public showcase build of Booklyt.
> It is the complete platform, with one deliberate difference: **customer phone
> verification is switched off**, so anyone can walk the entire booking flow
> end-to-end without a WhatsApp Business account. Reservations are created
> instantly with no verification step, and the booking pages show no sign-in
> prompt — booking has never required an account.
>
> **The production deployment verifies every booking with a WhatsApp one-time
> passcode.** That code ships in this repository and is fully intact; it is
> gated behind a single flag, not removed. See
> [Verification: showcase vs. production](#verification-showcase-vs-production).

## The problem

A barber who wants online booking has two bad options: a subscription platform
that puts *its* brand above his and rents him a profile page, or a link-in-bio
form that drops bookings. Neither gives him a site that looks like his shop, and
neither gives his customers an app.

Booklyt gives each business its own branded site at `/book/<name>`, its own
mini-app inside a shared customer app, and a dashboard — from one signup flow,
with no designer and no developer.

## What it does

### For the business owner

- **Visual website builder** — five starter templates, eight rearrangeable
  section types, live phone preview, and a draft/publish workflow. No code.
- **Dashboard** — appointments, services and service categories, staff,
  opening hours with per-day breaks, announcements, and an activity timeline
  of every change to every booking.
- **Booking rules** — per-slot or per-day (group) capacity, optional or
  required staff selection, custom slot intervals, a booking horizon, and
  timezone-aware availability.
- **Confirmation policy** — bookings can land confirmed, or held as `pending`
  for the owner to approve.
- **Announcements** — broadcast to customers who have actually interacted with
  that business, over push and WhatsApp.
- **Own-brand mobile presence** — a per-business PWA manifest, app name, icon,
  QR code and a shareable 6-digit business code.

### For their customers

- **One app, every business** — a single install (iOS/Android) that works with
  every business on the platform. Find a shop by 6-digit code or QR scan.
- **Book, reschedule and cancel from a link that needs no account** — the
  booking link carries an unguessable manage token.
- **Waitlist** — join when a day is full, and get notified the moment a slot
  frees up.
- **Reminders** via web push, native push and WhatsApp.
- **Calendar export** (`.ics`) for any booking.
- **English + Arabic**, with full RTL layout.

### For the operator

- **Marketplace surface** — search and discovery across every business.
- **Admin portal** — per-business support access to appointments, services,
  staff, hours and notification settings.
- **Cron-driven jobs** — appointment reminders and WhatsApp reminders run on a
  schedule, with a message log for delivery auditing.

## Architecture

```
                       ┌────────────────────────────────┐
  Business websites →  │   Next.js 15 (App Router)      │
  Business mini-apps → │   /book/[slug]   per-tenant    │
  Customer app       → │   /app           marketplace   │
  Deep links         → │   /app/business/[code]         │
  Owner dashboard    → │   /dashboard                   │
                       └────────────────┬───────────────┘
                                        │ server.url
                       ┌────────────────┴───────────────┐
                       │  Capacitor shell (iOS/Android) │
                       │  push · deep links · QR scan   │
                       │  back button · offline shell   │
                       └────────────────┬───────────────┘
                                        │
                       ┌────────────────┴───────────────┐
                       │  Supabase Postgres             │
                       │  23 tables · 37 RLS policies   │
                       └────────────────────────────────┘
```

**Multi-tenancy is enforced in the database, not the application.** Every tenant
table carries a `business_id` and row-level security scopes it to the owning
account. A bug in application code cannot leak one business's customers to
another — the policy is the boundary.

**Two separate identity systems.** Business owners are Supabase `auth.users`.
Customers are a separate phone-based identity, so a customer of three different
barbershops is one person with one login, not three accounts.

**Public flows never touch the anon key.** Booking, rescheduling and cancelling
authorise on an unguessable `manage_token` through service-role API routes, so
the `appointments` table needs no public read policy — customer names, phones
and emails are never exposed to a browser key.

## Engineering highlights

Things in here worth pointing at in a code review:

| | |
|---|---|
| **Availability engine** | Generates slots from opening hours minus breaks, existing bookings, per-slot capacity and service duration — timezone-aware, and re-validated server-side on write, so a stale browser tab cannot book a slot that filled up while it sat open. |
| **Draft / publish pipeline** | The builder writes draft columns; publishing snapshots them into an immutable `published_config_json`. The public site only ever reads the snapshot, so an in-progress edit can never appear on a live website. |
| **Structural anti-spam** | Announcement recipients are computed server-side from customers who actually interacted with that business. A business physically cannot message anyone else. |
| **Schema as one source of truth** | A consolidated baseline migration rebuilds the entire database and storage layer from zero, reconciled against the live database and verified object by object — alongside 50 incremental migrations that record how it got there. |
| **One codebase, three surfaces** | The website, the PWA and the native apps all render from the same Next.js routes; `?mode=app` swaps in native chrome instead of forking the UI. |
| **Policy behind one seam** | Verification strategy (`none` / `otp` / `link`) resolves through a single module consumed by both the client flow and the write path, so the showcase and production builds differ by a flag rather than by a branch. |

## Verification: showcase vs. production

Booking verification is a first-class, per-business setting
(`businesses.booking_verification_method`) with three strategies:

| Strategy | Behaviour |
|---|---|
| `otp` | Customer receives a 4-digit WhatsApp passcode and verifies before the booking is written. **This is the production default.** |
| `link` | The booking is written as `pending` and a WhatsApp confirmation link promotes it to confirmed. |
| `none` | The booking is written immediately, with no verification step. |

All three paths are implemented in this repository. A single module,
[`src/lib/booking-verification.ts`](src/lib/booking-verification.ts), resolves
the effective strategy and is consumed by both the client booking flow and the
server write path.

This showcase build resolves every business to `none`. To restore full
production behaviour — per-business WhatsApp OTP — set one environment variable
and provide WhatsApp credentials:

```bash
NEXT_PUBLIC_BOOKING_VERIFICATION_ENABLED=true
```

No other code change is required.

## Tech stack

**Frontend** Next.js 15 (App Router, React Server Components) · React 18 ·
TypeScript (strict) · Tailwind CSS · Radix UI · Framer Motion · Puck (visual editor)
**Backend** Next.js Route Handlers · Supabase Postgres with RLS · Supabase Storage · Zod
**Mobile** Capacitor 7 (iOS + Android) · Firebase Cloud Messaging
**Messaging** Web Push (VAPID) · WhatsApp via Meta Cloud API / Twilio
**Infra** Vercel · cron-driven reminder jobs

## Scale of the codebase

| | |
|---|---|
| API route handlers | 49 |
| Pages | 31 |
| React components | 66 |
| TypeScript / TSX | ~29,000 lines |
| Database tables | 23 |
| RLS policies | 37 |
| Migrations | 50 |

Designed, built, deployed and piloted solo.

## Repository layout

```
src/app/book/[businessSlug]     per-tenant branded booking website
src/app/app                     customer marketplace app (search, bookings, profile)
src/app/dashboard               business owner dashboard
src/app/admin                   operator/support portal
src/app/api                     49 route handlers (booking, auth, push, WhatsApp, cron)
src/components/booking          the booking flow
src/components/builder          visual website builder
src/components/layouts          tenant website rendering (shell, header, sections)
src/lib                         availability, verification, WhatsApp, push, i18n, Supabase
supabase/baseline               full schema rebuild from zero
supabase/migrations             50 incremental migrations
mobile                          Capacitor iOS + Android shell
docs                            mobile architecture, store builds, design notes
```

## Running it locally

```bash
git clone <this-repo> && cd booklyt
npm install
cp .env.local.example .env.local     # add your Supabase keys
npm run dev
```

Need a database? `supabase/baseline/00000000000000_baseline.sql` builds the whole
schema and storage layer from scratch on an empty Supabase project.

Fuller guides: [SETUP.md](SETUP.md) · [QUICKSTART.md](QUICKSTART.md) ·
[docs/booklyt/](docs/booklyt/) for the mobile architecture and store builds.

---

<div align="center">
<sub>Built by Ahmed Hosh</sub>
</div>
