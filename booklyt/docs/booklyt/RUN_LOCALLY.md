# Run Booklyt locally

## Web (everything except native shells)

```bash
cp .env.local.example .env.local   # fill Supabase + WhatsApp keys
npm install
npm run dev                        # http://localhost:3000
```

Apply the migrations in `supabase/migrations/` to your Supabase project
(SQL editor, in filename order — the four `20260711…` files are the new ones).

Useful local URLs:

- `http://localhost:3000/app` — customer app (marketplace)
- `http://localhost:3000/app/business/<code>` — universal-link resolution
- `http://localhost:3000/api/business/<slug>/qr` — QR PNG
- `http://localhost:3000/.well-known/assetlinks.json` — App Links file

Checks: `npm run lint && npx tsc --noEmit && npm run build`

## Native apps against your local server

The apps load the web app from a server URL. Point them at your machine
(use your LAN IP, not localhost — the phone/emulator must reach it):

```bash
cd mobile
npm install
CAP_SERVER_URL=http://192.168.1.20:3000/app npx cap sync
npx cap open android    # or: npx cap open ios
```

`cleartext` (plain http) is enabled automatically only when the URL starts
with `http://`. For production builds simply omit `CAP_SERVER_URL` — it
defaults to `https://booklyt.net/app`.

## Testing deep links

```bash
# Android (emulator or device via adb)
adb shell am start -a android.intent.action.VIEW -d "booklyt://business/123456"
adb shell am start -a android.intent.action.VIEW -d "https://booklyt.net/app/business/123456"

# iOS simulator
xcrun simctl openurl booted "booklyt://business/123456"
```

## Testing push

1. Set `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local` (see BUILD_ANDROID.md).
2. Sign in inside the app (profile tab) — the bridge registers the device at
   `/api/customer/push-token`.
3. Book/cancel/reschedule, or trigger the cron:
   `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders`
