# Store submission checklist

## Both stores

- [ ] booklyt.net deployed with `NEXT_PUBLIC_APP_URL=https://booklyt.net`
- [ ] `/.well-known/assetlinks.json` returns your cert fingerprints
- [ ] `/.well-known/apple-app-site-association` returns your Team ID
- [ ] `https://booklyt.net/privacy` and `/terms` reachable
- [ ] Icons + splash generated (`npx @capacitor/assets generate`)
- [ ] Deep links tested on real devices (see RUN_LOCALLY.md)
- [ ] Push tested end-to-end (sign in → book → receive notification)
- [ ] Offline behavior tested (airplane mode → fallback screen → retry)
- [ ] Screenshots: home, business mini-app, booking flow, bookings list,
      notifications (per required device sizes)

## Google Play

- [ ] AAB signed with the release keystore (or Play App Signing)
- [ ] Play App Signing cert SHA-256 added to `ANDROID_CERT_SHA256_FINGERPRINTS`
- [ ] Data safety form: phone + name (account), push token (notifications);
      data encrypted in transit; deletion via support
- [ ] Content rating questionnaire
- [ ] `pm get-app-links com.booklyt.app` shows `verified` on a Play-installed build

## Apple App Store

- [ ] Push Notifications + Associated Domains capabilities enabled on the App ID
- [ ] APNs key uploaded to Firebase (FCM delivers to APNs)
- [ ] App Privacy labels filled (no tracking)
- [ ] Reviewer demo account / test phone documented in review notes
- [ ] Account deletion path stated (Apple 5.1.1(v)): profile → support contact
- [ ] 4.2 mitigation noted: native push, QR scanner, universal links,
      offline handling, back/status-bar integration

## Common rejection reasons covered

| Risk | Mitigation in this codebase |
|---|---|
| "Just a website in a WebView" | Native QR scan, push, deep links, offline shell, back-button handling |
| Broken links | privacy/terms pages ship with the web app |
| Notification spam | structural anti-spam + per-business mute + 1/24h limit |
| Missing permission prompts | push permission requested in-context after sign-in; camera only on scan |
| Login friction for review | passwordless OTP; document a demo number |
