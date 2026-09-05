import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { NumberedDocRow, NumberedDocSnapshot } from "@/lib/documents/numbered-doc";
import {
  DOC_DEFS,
  NumberedDocSheet,
} from "@/components/documents/numbered-doc-sheet";
import { createNumberedDocument } from "../doc-actions";
import { DocToolbar } from "./doc-client";

export const metadata = { title: "מסמך להדפסה" };

/**
 * Printable receipt (קבלה) / delivery note (תעודת משלוח). Only orders flagged
 * for a receipt have one; others show a notice instead of minting a number.
 */
export default async function NumberedDocPage({
  params,
}: {
  params: Promise<{ id: string; type: string }>;
}) {
  const { id, type } = await params;
  const docDef = DOC_DEFS[type];
  if (!docDef) notFound();

  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, receipt")
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!order) notFound();
  if (!order.receipt) {
    return (
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <DocToolbar orderId={id} title={docDef.title} />
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          הזמנה זו אינה מסומנת לקבלה, לכן לא ניתן להפיק {docDef.title}. ניתן
          לסמן את הלקוח או ההזמנה כ&quot;קבלה&quot;.
        </div>
      </div>
    );
  }

  // First visit creates the numbered snapshot; later visits reuse the latest
  // one so printed documents keep their number and content. The create
  // action returns the inserted row directly — re-selecting the same query
  // in this render would be served from fetch memoization (the empty result
  // above) and 404 the very first visit.
  const { data: existing } = await supabase
    .from("order_documents")
    .select("snapshot, doc_number, created_at")
    .eq("order_id", id)
    .eq("doc_type", docDef.dbType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let doc: NumberedDocRow | null = existing
    ? {
        snapshot: existing.snapshot as NumberedDocSnapshot,
        doc_number: Number(existing.doc_number),
        created_at: existing.created_at,
      }
    : null;

  if (!doc) {
    const created = await createNumberedDocument(id, docDef.dbType, false);
    if (!created.ok || !created.doc) notFound();
    doc = created.doc;
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <DocToolbar orderId={id} title={docDef.title} />
      <NumberedDocSheet
        title={docDef.title}
        numberLabel={docDef.numberLabel}
        snapshot={doc.snapshot}
        docNumber={Number(doc.doc_number ?? doc.snapshot.doc_number)}
        createdAt={doc.created_at}
      />
    </div>
  );
}
