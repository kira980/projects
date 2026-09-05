import { redirect } from "next/navigation";

/** Moved: this report now lives at /dashboard/vendors. */
export default async function Moved({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) params.set(k, v);
  params.set("view", "report");
  const qs = params.toString();
  redirect(qs ? `/dashboard/vendors?${qs}` : "/dashboard/vendors");
}
