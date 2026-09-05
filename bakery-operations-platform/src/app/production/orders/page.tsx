import { ProductionOrdersPage } from "./production-orders-page";

export const dynamic = "force-dynamic";

/** The prep screen — משלוח and איסוף עצמי together. */
export default async function ProductionOrdersRoute({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  return <ProductionOrdersPage searchParams={searchParams} />;
}
