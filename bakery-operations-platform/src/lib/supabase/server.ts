import { cookies } from "next/headers";
import { createDemoClient, type CookieAdapter } from "@/lib/demo-backend/client";

/**
 * The database client, server side.
 *
 * In production these two functions returned Supabase clients — one carrying
 * the signed-in user's session (so PostgreSQL row-level security applied) and
 * one using the service role for the passcode flows that run before any user
 * session exists.
 *
 * The demo keeps both entry points and both meanings, backed by the in-memory
 * store in `@/lib/demo-backend`. Every one of the 79 modules that calls these
 * is unchanged; only what they receive is different.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const adapter: CookieAdapter = {
    get: (name) => cookieStore.get(name)?.value,
    set: (name, value, options) => {
      try {
        cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
      } catch {
        // Called from a Server Component, where cookies are read-only.
      }
    },
    remove: (name) => {
      try {
        cookieStore.delete(name);
      } catch {
        // As above.
      }
    },
  };

  return createDemoClient(adapter);
}

/**
 * Service-role client. Server-only.
 *
 * Used for the operations row-level security could not express — chiefly
 * verifying a worker's passcode before any session exists. It carries no user
 * session, which is exactly what "bypasses RLS" meant in production.
 */
export function createServiceClient() {
  return createDemoClient();
}
