import { QueryBuilder, type QueryResult } from "./query";
import { callRpc } from "./rpc";
import { AUTH_COOKIE, DEMO_PASSWORD, findUserByEmail, findUserById, type DemoUser } from "./auth";
import { putFile, signedUrlFor } from "./storage";

/** Shape of a storage failure, so callers can still branch on it. */
type StorageError = { message: string } | null;

/**
 * A drop-in replacement for the Supabase client.
 *
 * Every call site in the application — 79 files, ~500 filter calls, 12 stored
 * procedures — is untouched. The demo therefore exercises the real application
 * code rather than a reimplementation of it; only the thing behind
 * `@/lib/supabase/*` changed.
 */

export type CookieAdapter = {
  get(name: string): string | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  remove(name: string): void;
};

const noopCookies: CookieAdapter = {
  get: () => undefined,
  set: () => {},
  remove: () => {},
};

export type DemoClient = ReturnType<typeof createDemoClient>;

export function createDemoClient(cookies: CookieAdapter = noopCookies) {
  const currentUser = (): DemoUser | null => {
    const id = cookies.get(AUTH_COOKIE);
    return id ? findUserById(id) : null;
  };

  return {
    from(tableName: string) {
      return new QueryBuilder(tableName);
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc(name: string, args: Record<string, unknown> = {}): Promise<QueryResult<any>> {
      return Promise.resolve(callRpc(name, args));
    },

    auth: {
      async getUser() {
        const user = currentUser();
        return { data: { user }, error: user ? null : { message: "Auth session missing!" } };
      },

      /**
       * Production verifies the session JWT locally against the project's
       * signing keys. Here the cookie is the claim.
       */
      async getClaims() {
        const user = currentUser();
        return {
          data: user ? { claims: { sub: user.id, email: user.email } } : null,
          error: null,
        };
      },

      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const user = findUserByEmail(email);
        if (!user || password !== DEMO_PASSWORD) {
          return {
            data: { user: null, session: null },
            error: { message: "Invalid login credentials", status: 400 },
          };
        }
        cookies.set(AUTH_COOKIE, user.id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 12,
        });
        return { data: { user, session: { user } }, error: null };
      },

      async signOut() {
        cookies.remove(AUTH_COOKIE);
        return { error: null };
      },
    },

    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File, _options?: unknown) {
            void _options;
            putFile(bucket, path, file);
            return { data: { path }, error: null as StorageError };
          },
          async createSignedUrl(path: string, _expiresIn: number) {
            void _expiresIn;
            return { data: { signedUrl: signedUrlFor(bucket, path) }, error: null as StorageError };
          },
          async createSignedUrls(paths: string[], _expiresIn: number) {
            void _expiresIn;
            return {
              data: paths.map((path) => ({
                path,
                signedUrl: signedUrlFor(bucket, path),
                error: null as StorageError,
              })),
              error: null as StorageError,
            };
          },
          async remove(paths: string[]) {
            return { data: paths.map((path) => ({ name: path })), error: null as StorageError };
          },
          getPublicUrl(path: string) {
            return { data: { publicUrl: signedUrlFor(bucket, path) } };
          },
        };
      },
    },
  };
}
