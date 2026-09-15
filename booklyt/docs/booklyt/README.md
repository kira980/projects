# Booklyt Customer Platform

One customer app — unlimited businesses. Every business keeps its own booking
website, dashboard, and branding; customers install a single Booklyt app
(Android/iOS, built with Capacitor from the same Next.js codebase) that works
with all of them.

## How it fits together

```
                       ┌──────────────────────────────┐
                       │   Next.js app (booklyt.net)  │
  Business websites →  │  /book/[slug]   (per-tenant) │
  Business mini-apps → │  /app/[slug]    (native mode)│
  Customer app       → │  /app           (marketplace)│
  Link resolution    → │  /app/business/[code]        │
  Link verification  → │  /.well-known/*              │
                       └───────────────┬──────────────┘
                                       │  server.url
                       ┌───────────────┴──────────────┐
                       │  Capacitor apps (mobile/)     │
                       │  com.booklyt.app              │
                       │  native bridge: back button,  │
                       │  push, deep links, QR scan,   │
                       │  offline fallback shell       │
                       └──────────────────────────────┘
```

## Business identity (automatic, no manual setup)

Every business gets, at creation time (DB trigger — cannot be skipped):

| Item | Example | Where |
|---|---|---|
| Business code | `482113` (6 digits, unique) | `businesses.business_code` |
| Website | `https://booklyt.net/book/ahmad-barber` | existing slug |
| Universal link | `https://booklyt.net/app/business/482113` | resolves code → mini-app |
| Deep link | `booklyt://business/482113` | opens the native app |
| QR code | `GET /api/business/[slug]/qr` | generated on the fly, cached |
| Opt-out | `businesses.app_enabled` | `false` hides it from the app |

Existing businesses were backfilled by migration `20260711000000_business_code.sql`.

## Customer accounts

Customers sign in once (phone + WhatsApp OTP — the existing `customer_users`
identity) and get, across ALL businesses:

- **My Businesses** — auto-saved on first visit/booking (`customer_businesses`:
  first/last visit, visit count, favorite, per-business notification mute)
- **My Bookings** — all businesses in one list; cancel, **reschedule**,
  directions, WhatsApp contact, add-to-calendar (.ics)
- **Notification center** — confirmations, reminders, cancellations, changes,
  waitlist openings, announcements (`customer_notifications` + FCM push)

## Anti-spam guarantee (structural)

Businesses can only reach customers who interacted with them: announcement
recipients are computed **server-side only** from
`customer_businesses WHERE business_id = <authed business> AND notifications_enabled`.
There is no API parameter to target anyone else, and announcements are limited
to one per business per 24 h. Customers can mute any business from their profile.

## Key code map

| Area | Path |
|---|---|
| Platform identity/links | `src/lib/booklyt.ts` |
| Code resolution | `src/lib/business-code.ts`, `src/app/app/(marketplace)/business/[slug]/page.tsx` |
| QR generation | `src/app/api/business/[businessSlug]/qr/route.ts` |
| App/universal link files | `src/app/.well-known/{assetlinks.json,apple-app-site-association}/route.ts` |
| Saved businesses | `src/lib/customer/businesses.ts`, `src/app/api/customer/businesses/route.ts` |
| Customer bookings | `src/app/api/customer/bookings/route.ts`, `src/lib/marketplace/queries.ts` |
| Reschedule | `src/app/api/book/manage/reschedule/route.ts`, `src/app/manage-booking/[token]/reschedule-sheet.tsx` |
| Notifications | `src/lib/notifications/customer.ts` (choke point), `src/lib/push/{customer-push,firebase}.ts` |
| Push tokens | `src/app/api/customer/push-token/route.ts`, `customer_devices` table |
| Share & App UI | `src/components/share-app/*`, `/dashboard/share`, `/admin/[slug]/share` |
| Native bridge | `src/components/native/NativeBridge.tsx` (mounted by `src/app/app/layout.tsx`) |
| Mobile apps | `mobile/` (see `mobile/README.md`) |

## Environment variables

See `.env.local.example`. New for Booklyt:

- `NEXT_PUBLIC_APP_URL` — production origin (`https://booklyt.net`); QR codes,
  links, and `.well-known` files derive from it
- `ANDROID_CERT_SHA256_FINGERPRINTS` — comma-separated signing-cert SHA-256s
  (App Links verification)
- `APPLE_TEAM_ID` — for `apple-app-site-association`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — enables native push (optional until set;
  everything else works without it)
- `CRON_SECRET` — protects `/api/cron/*`

## Database migrations

Apply the four new files in `supabase/migrations/` (Supabase SQL editor or
`supabase db push`), in order:

1. `20260711000000_business_code.sql` — code column, generator, trigger, backfill
2. `20260711000001_customer_businesses.sql`
3. `20260711000002_customer_devices.sql`
4. `20260711000003_customer_notifications.sql` — also backfills
   `appointments.customer_user_id` by normalized phone

All are additive; nothing existing is altered or dropped. The new tables have
RLS enabled with **no policies** on purpose — they are reachable only through
session-checked API routes using the service-role client (the same pattern as
`customer_users`).

## More docs

- [RUN_LOCALLY.md](RUN_LOCALLY.md)
- [BUILD_ANDROID.md](BUILD_ANDROID.md)
- [BUILD_IOS.md](BUILD_IOS.md)
- [STORE_CHECKLIST.md](STORE_CHECKLIST.md)
- [NOTIFICATIONS.md](NOTIFICATIONS.md)
