# Notification catalog & rules

All customer notifications flow through `notifyCustomer()`
(`src/lib/notifications/customer.ts`): it writes the in-app notification-center
row, then fans out to the customer's native devices via FCM
(`customer_devices`, dead tokens pruned automatically). WhatsApp messages keep
using the existing `src/lib/whatsapp.ts` channel unchanged.

## Triggers

| Type | Fired from | Channel(s) |
|---|---|---|
| `booking_confirmed` | `POST /api/book` (signed-in customer) | in-app + FCM (+ WhatsApp confirm, existing) |
| `booking_reminder` | `GET /api/cron/reminders` (~1 h before, per business TZ) | in-app + FCM (+ existing web push / WhatsApp cron) |
| `booking_cancelled` | `POST /api/book/manage/cancel` | in-app + FCM |
| `booking_changed` | `POST /api/book/manage/reschedule` | in-app + FCM (+ business push) |
| `waitlist` | `src/lib/waitlist/notify.ts` (slot freed) | in-app + FCM (+ WhatsApp, existing) |
| `announcement` | `POST /api/dashboard/announcements` or `/api/admin/portal/[slug]/announcements` | in-app + FCM |
| `rebooking` | type reserved — no automatic trigger yet (send via announcement or add a cron) |

## Anti-spam rules (enforced server-side, not by convention)

1. Announcement recipients are computed only from
   `customer_businesses WHERE business_id = <authenticated business>
   AND notifications_enabled = true`. The request body contains title/body
   only — there is no way to supply recipients.
2. One announcement per business per 24 h (`business_announcements.sent_at`).
3. Customers mute any business (profile → bell icon), which removes them from
   every future broadcast by that business.
4. Push tokens are tied to authenticated `customer_users` sessions
   (`/api/customer/push-token` requires the `bf_user` cookie).

## Requirements

Native FCM delivery needs `FIREBASE_SERVICE_ACCOUNT_JSON` set on the server
and the Firebase config files in the native projects (see BUILD_ANDROID.md /
BUILD_IOS.md). Without them, sends are skipped gracefully and the in-app
notification center still works.
