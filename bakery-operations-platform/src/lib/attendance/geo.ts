/**
 * Distance helpers for the attendance geofence. Pure functions, no server
 * imports, so they can be unit-tested on their own.
 */

/** Metres between two coordinates, over a spherical earth. */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A coordinate pair that could plausibly be on earth. */
export function isValidCoords(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // 0,0 is in the Atlantic; it is what a broken sensor reports.
    !(lat === 0 && lng === 0)
  );
}

/**
 * The caller's public IP, as the platform's proxy reports it.
 *
 * On Vercel every request carries x-forwarded-for, whose FIRST entry is
 * the client. Later entries are proxies and are attacker-controllable in
 * general, so only the first is ever considered.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || null;
}

/** True when the request came through one of the site's known networks. */
export function isAllowedIp(
  ip: string | null,
  allowed: string[] | null | undefined
): boolean {
  if (!ip || !allowed?.length) return false;
  return allowed.includes(ip);
}
