import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Booklyt — Capacitor configuration.
 *
 * The apps load the deployed Next.js customer app (/app routes) directly, so
 * web and native share one frontend. The bundled `dist` shell is only the
 * offline/error fallback (see server.errorPath).
 *
 * Dev override (points the WebView at your local Next.js server):
 *   CAP_SERVER_URL=http://192.168.1.20:3000/app npx cap sync
 * cleartext is enabled automatically only for http:// dev URLs.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? 'https://booklyt.net/app'

const config: CapacitorConfig = {
  appId: 'com.booklyt.app',
  appName: 'Booklyt',
  webDir: 'dist',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    errorPath: 'index.html',
  },
  plugins: {
    StatusBar: {
      style: 'Default',
      backgroundColor: '#ffffff',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#7c3aed',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
