import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { ProductionLoginScreen } from "./login-screen";

/** Only the two production screens are valid post-login destinations. */
function safeNext(next: string | undefined): string {
  return next === "/production/takeaway"
    ? "/production/takeaway"
    : "/production/orders";
}

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNext(next);
  const session = await getWorkerSession("production");
  if (session) redirect(dest);
  return <ProductionLoginScreen next={dest} />;
}
