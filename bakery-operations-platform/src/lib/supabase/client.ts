import { createDemoClient } from "@/lib/demo-backend/client";

/**
 * Browser-side client.
 *
 * The demo backend lives in the server process, so this exists only to keep
 * the import contract intact for the handful of client components that ask for
 * a client. Anything that actually needs data goes through a Server Component
 * or a Server Action.
 */
export function createClient() {
  return createDemoClient();
}
