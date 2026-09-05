import { createHash, randomBytes } from "crypto";

/**
 * Pure token helpers for the Android device auth — no server-only or
 * Supabase imports, so they are unit-testable in isolation.
 */

/** Generate a fresh opaque token (returned to the device once). */
export function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 (hex) of a token — only the hash is persisted server-side. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Extract the bearer token from an Authorization header, or null. */
export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}
