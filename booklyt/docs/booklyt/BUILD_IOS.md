# Build & publish — iOS (Booklyt)

Bundle ID: `com.booklyt.app` · Project: `mobile/ios/App` (opens in Xcode)

## One-time setup

1. **Apple Developer account** with the `com.booklyt.app` App ID, capabilities:
   Push Notifications + Associated Domains.

2. **Universal Links.** Put your Team ID into the server env `APPLE_TEAM_ID`
   and redeploy — it's served at
   `https://booklyt.net/.well-known/apple-app-site-association`.
   The app's entitlements (`mobile/ios/App/App/App.entitlements`) already
   declare `applinks:booklyt.net`.

3. **Push (APNs via FCM).** In your Firebase project add an iOS app with
   bundle `com.booklyt.app`, download `GoogleService-Info.plist` into
   `mobile/ios/App/App/`, and upload your APNs key (Developer portal →
   Keys → APNs) to Firebase → Cloud Messaging.
   Note: the entitlements ship with `aps-environment = development`; Xcode
   switches it to `production` automatically when archiving for distribution.

4. **Icons & splash.** Same as Android: assets in `mobile/assets/`, then
   `npx @capacitor/assets generate`.

## Build

```bash
cd mobile
npm install
npm run build
npx cap sync ios        # runs pod install — needs CocoaPods (sudo gem install cocoapods)
npx cap open ios
```

In Xcode:
1. Select the App target → Signing & Capabilities → your team
   (bundle `com.booklyt.app`, automatic signing).
2. Run on a device/simulator to smoke-test.
3. **Archive** (Product → Archive, "Any iOS Device") → Distribute →
   App Store Connect → produces the IPA and uploads it.

## Publish to the App Store

1. App Store Connect → New app (Booklyt, `com.booklyt.app`).
2. TestFlight the uploaded build first.
3. Fill App Privacy: collects phone number + name (account, app functionality),
   push tokens (app functionality); no tracking. Privacy policy
   `https://booklyt.net/privacy`, terms `https://booklyt.net/terms`.
4. Review notes: mention a demo phone number + OTP path for the reviewer, or
   enable a review login. Account deletion is available via profile → support.
5. Guideline 4.2 (minimum functionality): the app is not a plain website
   wrapper — it has native push notifications, a native QR scanner, deep
   links/universal links, an offline fallback, and the hardware back-button /
   status-bar integration. Call these out in the review notes if asked.
