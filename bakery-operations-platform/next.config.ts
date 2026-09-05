import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 *
 * The vendored static menu and the Supabase origins are gone with the backend,
 * so the only external host left is the OpenStreetMap tile server used by the
 * driver's map — this build talks to no keyed third-party service at all.
 *
 * React's development build uses eval() to rebuild component stacks for its
 * error overlay, so 'unsafe-eval' is allowed while developing and never in a
 * production build. Without the split, `npm run dev` opens with a red issue
 * badge and a console full of warnings that mean nothing — which is how you
 * learn to ignore the console.
 *
 * Future hardening: nonce-based script-src, to drop 'unsafe-inline'.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // https: covers the OpenStreetMap tiles (*.tile.openstreetmap.org).
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://nominatim.openstreetmap.org${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Driver map/sort needs geolocation; everything else is off.
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // The workers app used to live at /kiosk — installed PWAs and old
    // bookmarks still point there.
    return [
      { source: "/kiosk", destination: "/workers", permanent: true },
      { source: "/kiosk/:path*", destination: "/workers/:path*", permanent: true },
      // Sales moved into the daily overview.
      { source: "/dashboard/sales", destination: "/dashboard/simple", permanent: true },
    ];
  },
};

export default nextConfig;
