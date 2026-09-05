import type { createDemoClient } from "./client";

/**
 * The types the application used to import from `@supabase/supabase-js`.
 *
 * Keeping the same names means the ten modules that take a client as a
 * parameter did not have to change — only where the type comes from.
 */
export type SupabaseClient = ReturnType<typeof createDemoClient>;

export type PostgrestError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};
