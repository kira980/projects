# Build & publish — Android (Booklyt)

App ID: `com.booklyt.app` · Project: `mobile/android` (opens in Android Studio)

## One-time setup

1. **Firebase (push).** Create a Firebase project, add an Android app with
   package `com.booklyt.app`, download `google-services.json` into
   `mobile/android/app/`. The gradle config applies the google-services plugin
   automatically when the file exists (build works fine without it — push is
   simply disabled).
   Also put the service-account JSON (Project settings → Service accounts →
   Generate key) into the server env `FIREBASE_SERVICE_ACCOUNT_JSON`.

2. **Signing keystore.**
   ```bash
   keytool -genkey -v -keystore booklyt-release.keystore \
     -alias booklyt -keyalg RSA -keysize 2048 -validity 10000
   ```
   Keep it safe — losing it means you can't update the app.

3. **App Links verification.** Get the SHA-256 of your release cert
   (and of the Play App Signing cert from Play Console → App integrity):
   ```bash
   keytool -list -v -keystore booklyt-release.keystore -alias booklyt | grep SHA256
   ```
   Put them (comma-separated) into the server env
   `ANDROID_CERT_SHA256_FINGERPRINTS` and redeploy — they're served at
   `https://booklyt.net/.well-known/assetlinks.json`.

4. **Icons & splash.** Put a 1024×1024 `icon.png` and 2732×2732 `splash.png`
   in `mobile/assets/`, then:
   ```bash
   cd mobile && npx @capacitor/assets generate
   ```

## Build

```bash
cd mobile
npm install
npm run build          # builds the offline fallback shell
npx cap sync android   # production: server.url = https://booklyt.net/app
npx cap open android
```

In Android Studio:
- **Debug APK**: Build → Build APK(s)
- **Release AAB** (for Play): Build → Generate Signed App Bundle, pick the
  keystore from step 2
- CLI alternative: `cd mobile/android && ./gradlew bundleRelease`

## Publish to Google Play

1. Play Console → Create app (Booklyt, App/Productivity).
2. Upload the AAB to an internal testing track first.
3. Complete: content rating, target audience, **Data safety** (collects phone
   number + name for account/booking; push tokens for notifications; no ads,
   no data sold), privacy policy URL `https://booklyt.net/privacy`.
4. Verify App Links on a device:
   `adb shell pm verify-app-links --re-verify com.booklyt.app` then
   `adb shell pm get-app-links com.booklyt.app` (expect `verified`).
5. Promote to production once internal testing passes.
