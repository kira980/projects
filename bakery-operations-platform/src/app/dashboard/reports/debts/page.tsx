import { redirect } from "next/navigation";

/** Moved: this report now lives at /dashboard/customers. */
export default async function Moved({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
  params.set("view", "debts");
  const qs = params.toString();
  redirect(qs ? `/dashboard/customers?${qs}` : "/dashboard/customers");
}
