# Booklyt Mobile

Capacitor 7 project that ships the **Booklyt customer app** for Android and
iOS. There is no separate mobile frontend: the apps load the Next.js customer
app (`/app` routes) directly from the server, so web and native share one
codebase, one design, and one booking engine.

- App ID: `com.booklyt.app` · Name: **Booklyt** · Scheme: `booklyt://`
- Server UI: `https://booklyt.net/app` (override with `CAP_SERVER_URL` for dev)
- The bundled Vite build (`src/App.tsx`) is only the **offline/error fallback**
  shown when the server can't be reached (`server.errorPath`).

## Layout

```
mobile/
├── capacitor.config.ts        # identity + server.url + plugin config
├── src/
│   ├── App.tsx                # offline fallback screen (retry / auto-retry)
│   └── config/booklyt.ts      # shell identity constants
├── android/                   # opens in Android Studio (APK / AAB)
└── ios/App/                   # opens in Xcode (IPA)
```

The native behaviors (Android back button, push registration, deep-link
routing, offline banner, QR scanner) live in the **web codebase** —
`src/components/native/NativeBridge.tsx`, mounted by `src/app/app/layout.tsx` —
because Capacitor injects its runtime into the remotely-loaded pages.

## Plugins

app · barcode-scanner · haptics · keyboard · network · preferences ·
push-notifications · share · splash-screen · status-bar

## Common commands

```bash
npm install
npm run build                                    # offline shell → dist/
npx cap sync                                     # production config
CAP_SERVER_URL=http://<lan-ip>:3000/app npx cap sync   # local dev
npx cap open android
npx cap open ios                                 # needs CocoaPods installed
```

Full build/publish guides: `../docs/booklyt/BUILD_ANDROID.md` and
`../docs/booklyt/BUILD_IOS.md`.
