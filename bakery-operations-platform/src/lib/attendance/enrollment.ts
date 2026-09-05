import "server-only";
import { headers } from "next/headers";

/** How long a QR / WhatsApp link stays usable. */
export const ENROLLMENT_TTL_MINUTES = 10;

/**
 * Absolute URL of the enrollment page for a token.
 *
 * NEXT_PUBLIC_APP_URL wins when it is set, because the link leaves the
 * building: the owner may well be looking at a preview deployment, whose
 * URL sits behind Vercel's login wall and would hand the worker a sign-in
 * page instead of the enrol button. The phone also keeps its device cookie
 * per host, so a worker enrolled on a preview host would stop being
 * recognised the moment that deployment goes away.
 *
 * Without it, the request's own host is used, which is right for localhost
 * and for a single-domain deployment.
 */
export function appBaseUrl(headerList: Headers): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function enrollmentUrl(token: string): Promise<string> {
  return `${appBaseUrl(await headers())}/attendance/enroll/${token}`;
}

/**
 * True when the link would land on a Vercel preview deployment, which is
 * protected by Vercel's own login and therefore useless to a worker.
 * Surfaced in the dialog so the owner is told before they send it.
 */
export function isProtectedPreviewUrl(url: string): boolean {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  // A production alias looks like "bakery.vercel.app"; a preview carries the
  // deployment hash and the scope: "bakery-a1b2c3d4e-team.vercel.app".
  return /\.vercel\.app$/.test(host) && host.split("-").length > 2;
}

/**
 * The WhatsApp hand-off.
 *
 * With a number on file the chat opens straight at that worker. WITHOUT
 * one, wa.me is given no number at all, which makes WhatsApp show its own
 * contact picker — the owner chooses the worker there and the same link is
 * sent. Nothing is saved back to the CRM: the enrollment belongs to the
 * worker record, never to whichever number happened to receive it.
 */
export function whatsappUrl(
  phone: string | null | undefined,
  message: string
): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  // Israeli numbers are stored as 05X-XXXXXXX; wa.me wants them in full
  // international form with no plus.
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  const text = encodeURIComponent(message);
  return intl.length >= 11 ? `https://wa.me/${intl}?text=${text}` : `https://wa.me/?text=${text}`;
}

/** The message the owner sends, with the link already in it. */
export function enrollmentMessage(workerName: string, url: string): string {
  return [
    `שלום ${workerName},`,
    "",
    "זה הקישור לחיבור הטלפון שלך למערכת הנוכחות:",
    url,
    "",
    `הקישור בתוקף ל־${ENROLLMENT_TTL_MINUTES} דקות וניתן לשימוש פעם אחת בלבד.`,
  ].join("\n");
}
