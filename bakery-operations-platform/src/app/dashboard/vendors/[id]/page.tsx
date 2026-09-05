import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrls } from "@/lib/storage";
import { formatMoney, formatDateTime } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/db/vendors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VendorDialog } from "../vendor-dialog";

export const metadata = { title: "פרופיל ספק" };

function methodLabel(method: string | null) {
  if (!method) return "—";
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

export default async function VendorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!vendor) notFound();

  const [
    { data: orders },
    { data: payments },
    { data: debtRow },
    { data: workers },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("vendor_orders")
      .select("id, amount, status, payment_method, receipt_file_path, notes, received_at")
      .eq("vendor_id", id)
      .order("received_at", { ascending: false })
      .limit(100),
    supabase
      .from("vendor_payments")
      .select("id, amount, method, vendor_order_id, paid_by_type, paid_by_id, proof_file_path, notes, paid_at")
      .eq("vendor_id", id)
      .order("paid_at", { ascending: false })
      .limit(100),
    supabase
      .from("vendor_debts")
      .select("debt")
      .eq("vendor_id", id)
      .maybeSingle(),
    supabase
      .from("workers")
      .select("id, full_name")
      .eq("business_id", admin.business_id),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("business_id", admin.business_id),
  ]);

  const debt = Number(debtRow?.debt ?? 0);

  // Payments can be recorded by a worker or an admin — one name lookup.
  const payerNames = new Map<string, string>();
  for (const w of workers ?? []) payerNames.set(w.id, w.full_name);
  for (const p of profiles ?? []) payerNames.set(p.id, p.full_name);

  // Signed URLs for receipts/proofs (private buckets) — one batched
  // storage call per bucket, run in parallel.
  const ordersWithReceipts = (orders ?? []).filter((o) => o.receipt_file_path);
  const paymentsWithProofs = (payments ?? []).filter((p) => p.proof_file_path);
  const [receiptsByPath, proofsByPath] = await Promise.all([
    getSignedFileUrls(
      supabase,
      "receipts",
      ordersWithReceipts.map((o) => o.receipt_file_path as string)
    ),
    getSignedFileUrls(
      supabase,
      "proofs",
      paymentsWithProofs.map((p) => p.proof_file_path as string)
    ),
  ]);
  const receiptUrls = new Map<string, string>();
  for (const o of ordersWithReceipts) {
    const url = receiptsByPath.get(o.receipt_file_path as string);
    if (url) receiptUrls.set(o.id, url);
  }
  const proofUrls = new Map<string, string>();
  for (const p of paymentsWithProofs) {
    const url = proofsByPath.get(p.proof_file_path as string);
    if (url) proofUrls.set(p.id, url);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/dashboard/vendors">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{vendor.name}</h1>
        {!vendor.is_active && <Badge variant="destructive">לא פעיל</Badge>}
        <div className="ms-auto">
          <VendorDialog vendor={vendor} trigger={<Button variant="outline">עריכה</Button>} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">חוב פתוח</CardTitle>
          </CardHeader>
          <CardContent
            className={`text-2xl font-bold ${debt > 0 ? "text-destructive" : ""}`}
          >
            {formatMoney(debt)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">טלפון</CardTitle>
          </CardHeader>
          <CardContent dir="ltr" className="text-end font-medium">
            {vendor.phone ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">איש קשר</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">{vendor.contact_name ?? "—"}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">קבלות סחורה</TabsTrigger>
          <TabsTrigger value="payments">תשלומים</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>אמצעי</TableHead>
                  <TableHead>קבלה</TableHead>
                  <TableHead>הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(orders ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      אין קבלות סחורה עדיין
                    </TableCell>
                  </TableRow>
                )}
                {(orders ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{formatDateTime(o.received_at)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(o.amount)}</TableCell>
                    <TableCell>
                      {o.status === "paid" ? (
                        <Badge className="bg-green-600 hover:bg-green-600">שולם</Badge>
                      ) : (
                        <Badge variant="destructive">לא שולם</Badge>
                      )}
                    </TableCell>
                    <TableCell>{methodLabel(o.payment_method)}</TableCell>
                    <TableCell>
                      {receiptUrls.has(o.id) ? (
                        <a
                          href={receiptUrls.get(o.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          צפייה <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.notes ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>אמצעי</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>מי שילם</TableHead>
                  <TableHead>אסמכתא</TableHead>
                  <TableHead>הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      אין תשלומים עדיין
                    </TableCell>
                  </TableRow>
                )}
                {(payments ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(p.amount)}</TableCell>
                    <TableCell>{methodLabel(p.method)}</TableCell>
                    <TableCell>
                      {p.vendor_order_id ? "תשלום חשבונית" : "על חשבון חוב"}
                    </TableCell>
                    <TableCell>
                      {(p.paid_by_id && payerNames.get(p.paid_by_id)) || "—"}
                    </TableCell>
                    <TableCell>
                      {proofUrls.has(p.id) ? (
                        <a
                          href={proofUrls.get(p.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          צפייה <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.notes ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
