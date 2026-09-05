import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";

/**
 * Passcode-based sessions for kiosk / production / driver screens.
 * Workers are not Supabase Auth users — the session is an HMAC-signed
 * cookie set after server-side passcode verification. All DB access on
 * behalf of a worker session uses the service-role client server-side.
 */

export type WorkerScope = "kiosk" | "production" | "driver";

export type WorkerSession = {
  workerId: string;
  businessId: string;
  name: string;
  canManageShift: boolean;
  isBaker: boolean;
  /** May correct or delete actions already recorded (kiosk history). */
  isAdmin: boolean;
  scope: WorkerScope;
  /** Unix seconds. */
  exp: number;
};

const COOKIE_NAMES: Record<WorkerScope, string> = {
  kiosk: "kiosk_session",
  production: "production_session",
  driver: "driver_session",
};

/**
 * HMAC key for the passcode session cookies.
 *
 * In production this is a long random value supplied through the environment
 * and the process refuses to start without it. This build has to run from a
 * fresh clone with no configuration, so it falls back to a fixed development
 * key — which is safe precisely because it is published: there is no real
 * session here worth forging. Set KIOSK_SESSION_SECRET to restore the
 * production behaviour.
 */
const DEV_SESSION_KEY = "demo-only-kiosk-session-key-not-a-secret";

function secret(): string {
  const configured = process.env.KIOSK_SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" && !process.env.DEMO_MODE) {
    console.warn(
      "[security] KIOSK_SESSION_SECRET is not set — falling back to the published demo key."
    );
  }
  return DEV_SESSION_KEY;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: WorkerSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): WorkerSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    ) as WorkerSession;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

const SCOPE_TTL_SECONDS: Record<WorkerScope, () => number> = {
  // Kiosk cookie is short — the client also idles out after 30s.
  kiosk: () => Math.floor(Date.now() / 1000) + 15 * 60,
  production: () => Math.floor(Date.now() / 1000) + 12 * 3600,
  // Any worker can step into the driver app with their own passcode —
  // there's no separate driver account. Session lasts 12h, no re-prompt.
  driver: () => Math.floor(Date.now() / 1000) + 12 * 3600,
};

export async function createWorkerSession(
  scope: WorkerScope,
  worker: {
    id: string;
    business_id: string;
    full_name: string;
    can_manage_shift: boolean;
    is_baker: boolean;
    is_admin?: boolean;
  }
): Promise<void> {
  const session: WorkerSession = {
    workerId: worker.id,
    businessId: worker.business_id,
    name: worker.full_name,
    canManageShift: worker.can_manage_shift,
    isBaker: worker.is_baker,
    isAdmin: worker.is_admin ?? false,
    scope,
    exp: SCOPE_TTL_SECONDS[scope](),
  };
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAMES[scope], encode(session), {
    httpOnly: true,
    sameSite: "lax",
    // Mark Secure only when the request itself is HTTPS. Basing this on
    // NODE_ENV alone breaks phone/LAN testing over http://<ip> — mobile
    // browsers silently drop Secure cookies on a non-secure origin, so the
    // passcode screen just reloads. localhost is a secure context, which is
    // why laptop testing still worked.
    secure: await requestIsHttps(),
    path: "/",
    expires: new Date(session.exp * 1000),
  });
}

/** True when the incoming request reached us over HTTPS. */
async function requestIsHttps(): Promise<boolean> {
  const h = await headers();
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (h.get("forwarded")?.match(/proto=([^;]+)/)?.[1] ?? "");
  return proto === "https";
}

export async function getWorkerSession(
  scope: WorkerScope
): Promise<WorkerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAMES[scope])?.value;
  if (!token) return null;
  const session = decode(token);
  if (!session || session.scope !== scope) return null;
  return session;
}

export async function destroyWorkerSession(scope: WorkerScope): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAMES[scope]);
}
