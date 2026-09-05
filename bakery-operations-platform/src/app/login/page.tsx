import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "התחברות" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <LoginForm next={next ?? "/dashboard"} />
      </Suspense>
    </main>
  );
}
