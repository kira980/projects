# BookFlow Mobile — Architecture

> **SUPERSEDED (July 2026):** the app is now **Booklyt** (`com.booklyt.app`)
> and loads the Next.js customer app directly via Capacitor `server.url`;
> the HomeScreen/AppWebView shell described below was retired.
> See `README.md` here and `../docs/booklyt/` for the current architecture.

## Overview

The native app is a **thin shell** that wraps the existing Next.js booking system.
No booking logic is duplicated — all functionality lives on the server.

```
Native App (Capacitor)
  └─ HomeScreen           (business picker, recents, favourites)
      └─ AppWebView       (navigates to WebBase URL below)
          └─ /app/[businessSlug]   (Next.js — your server)
              └─ NativeAppShell    (renders full branded page)
                  └─ BookingFlow   (independent booking component)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/config/app-config.ts` | **Single source of truth** for white-label config |
| `src/components/AppWebView.tsx` | WebView wrapper with loading/error states |
| `src/components/HomeScreen.tsx` | Business picker UI |
| `src/lib/storage.ts` | Persistent recents/favourites (Capacitor Preferences) |
| `src/lib/deep-links.ts` | Deep-link listener (placeholder, ready to extend) |
| `capacitor.config.ts` | Capacitor platform config (reads from app-config) |

## Data Flow

1. User opens app → `HomeScreen` loads persisted recents/favourites.
2. User taps a business (or searches by slug) → `App.tsx` sets screen to `webview`.
3. `AppWebView` records the visit in recents, then:
   - **Native build**: calls `window.location.href = webBaseUrl/app/[slug]`
     Capacitor's WebView navigates to the Next.js server URL.
   - **Browser dev**: renders an `<iframe>` pointing to the same URL.
4. The Next.js `/app/[businessSlug]` route renders `NativeAppShell` → `BookingFlow`.
5. Sessions/cookies are preserved automatically by the WebView.

## White-Label Builds

To create a white-label app for a single business:

1. Edit `src/config/app-config.ts`:
   - Change `appId` (e.g. `com.mysalon.app`)
   - Change `appName` (e.g. `My Salon`)
   - Set `defaultBusinessSlug` to the business slug
   - Change `brandColor`
   - Change `webBaseUrl` if self-hosting

2. Replace assets:
   - `public/icon.png` — 512×512 px app icon
   - `public/splash.png` — 2732×2732 px splash screen

3. Build and sync:
   ```bash
   npm run sync
   ```

4. Open in Android Studio / Xcode and change the signing identity.

## Development Workflow

```bash
# Start Vite dev server (browser preview)
npm run dev

# Build + sync to native projects
npm run sync

# Open in Android Studio
npm run open:android

# Open in Xcode (macOS only)
npm run open:ios
```

## Deep Links

| Format | Status |
|--------|--------|
| `bookflow://business/[slug]` | Listener registered, AndroidManifest configured |
| `https://bookflow.app/app/[slug]` | Listener registered, needs `assetlinks.json` on server |

To enable verified Android App Links:
1. Set `android:autoVerify="true"` in AndroidManifest (currently `false`).
2. Host `https://bookflow.app/.well-known/assetlinks.json` with your SHA-256 fingerprint.

To enable iOS Universal Links:
1. Add `applinks:bookflow.app` to the Associated Domains entitlement.
2. Host `https://bookflow.app/.well-known/apple-app-site-association`.

## What is NOT in this app

- Booking logic (zero duplication — all on server)
- Push notifications (future work)
- QR scanner (placeholder button exists)
- Auth (customer auth handled by the web layer via cookies)
- Admin features (use the web admin portal)
