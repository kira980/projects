import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The takeaway prep screen is merged into /production/orders. Kept as a
 * redirect so the installed "הכנות איסוף עצמי" home-screen app still opens —
 * it lands on the merged screen with איסוף עצמי preselected.
 */
export default async function ProductionTakeawayRedirect({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const dateParam = /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? `&date=${date}` : "";
  redirect(`/production/orders?type=takeaway${dateParam}`);
}
