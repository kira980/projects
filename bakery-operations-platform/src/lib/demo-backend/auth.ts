import { table } from "./store";

/**
 * Demo authentication for the owner's dashboard.
 *
 * ⚠️  This replaces Supabase Auth. There is no password hashing, no token and
 * no verification beyond a shared demo password, because the point of a public
 * demo is to let a reviewer in without creating an account.
 *
 * The rest of the system is untouched: the dashboard still requires a session,
 * the middleware still redirects, and staff apps still authenticate with their
 * own passcodes against bcrypt hashes exactly as they do in production.
 */
export const DEMO_PASSWORD = "demo1234";
export const AUTH_COOKIE = "demo_auth_user";

export type DemoUser = { id: string; email: string };

export function findUserByEmail(email: string): DemoUser | null {
  const profile = table("profiles").find(
    (row) => String(row.email ?? "").toLowerCase() === email.trim().toLowerCase()
  );
  if (!profile) return null;
  return { id: String(profile.id), email: String(profile.email) };
}

export function findUserById(id: string): DemoUser | null {
  const profile = table("profiles").find((row) => row.id === id);
  if (!profile) return null;
  return { id: String(profile.id), email: String(profile.email) };
}

/** Every account a visitor can sign in as, for the login screen's hint list. */
export function demoAccounts(): { email: string; name: string; role: string }[] {
  return table("profiles").map((row) => ({
    email: String(row.email),
    name: String(row.full_name),
    role: String(row.role),
  }));
}
