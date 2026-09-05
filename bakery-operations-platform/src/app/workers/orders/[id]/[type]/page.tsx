import { notFound, redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/kiosk/session";
import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateNumberedDoc } from "@/lib/documents/numbered-doc";
import {
  DOC_DEFS,
  NumberedDocSheet,
} from "@/components/documents/numbered-doc-sheet";
import { PrintToolbar } from "../print-toolbar";
import { ordersBackHref } from "../../back-href";

export const metadata = { title: "מסמך להדפסה" };

export const dynamic = "force-dynamic";

/**
 * Worker-facing printable קבלה / תעודת משלוח. Reuses the same numbered
 * document the admin issues (or lazily issues it, scoped to the worker's
 * business). Delivery notes only apply to delivery orders.
 */
export default async function WorkerNumberedDocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; type: string }>;
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const { id, type } = await params;
  // `tab` is the list's איסוף / משלוח tab — distinct from the document type.
  const { date, type: tab } = await searchParams;
  const docDef = DOC_DEFS[type];
  if (!docDef) notFound();

  const session = await getWorkerSession("kiosk");
  if (!session) redirect("/workers");
  if (!session.canManageShift) redirect("/workers/menu");

  // Back goes to the day and tab the manager came from, not to today.
  const backHref = ordersBackHref(date, tab);

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, receipt, delivery_type")
    .eq("id", id)
    .eq("business_id", session.businessId)
    .single();

  if (!order) notFound();

  // Guard: receipt orders only; delivery notes only for delivery orders.
  const blocked =
    !order.receipt ||
    (docDef.dbType === "delivery_note" && order.delivery_type !== "delivery");

  if (blocked) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-4 p-4" dir="rtl">
        <PrintToolbar backHref={backHref} />
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          לא ניתן להפיק {docDef.title} להזמנה זו.
        </div>
      </div>
    );
  }

  const result = await getOrCreateNumberedDoc(
    supabase,
    session.businessId,
    id,
    docDef.dbType,
    { type: "worker", id: session.workerId, name: session.name }
  );
  if (!result.ok || !result.doc) notFound();
  const doc = result.doc;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4" dir="rtl">
      <PrintToolbar backHref={backHref} />
      <NumberedDocSheet
        title={docDef.title}
        numberLabel={docDef.numberLabel}
        snapshot={doc.snapshot}
        docNumber={doc.doc_number}
        createdAt={doc.created_at}
      />
    </div>
  );
}
