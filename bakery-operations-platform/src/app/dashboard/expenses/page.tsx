import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSignedFileUrls } from "@/lib/storage";
import { businessToday } from "@/lib/db/day-lock";
import { ExpensesClient, type ExpenseRow } from "./expenses-client";

export const metadata = { title: "הוצאות" };

export default async function ExpensesPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const monthStart = businessToday().slice(0, 8) + "01";

  const [{ data: expenses }, { data: workers }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("expenses")
        .select("id, amount, method, description, expense_date, spent_by_type, spent_by_id, receipt_file_path")
        .eq("business_id", admin.business_id)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("workers")
        .select("id, full_name")
        .eq("business_id", admin.business_id),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("business_id", admin.business_id),
    ]);

  const names = new Map<string, string>();
  for (const w of workers ?? []) names.set(w.id, w.full_name);
  for (const p of profiles ?? []) names.set(p.id, p.full_name);

  // All receipt URLs signed in one storage round trip.
  const receiptUrls = await getSignedFileUrls(
    supabase,
    "receipts",
    (expenses ?? [])
      .map((e) => e.receipt_file_path)
      .filter((p): p is string => Boolean(p))
  );

  const rows: ExpenseRow[] = (expenses ?? []).map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    method: e.method,
    description: e.description,
    expense_date: e.expense_date,
    spent_by_name: (e.spent_by_id && names.get(e.spent_by_id)) || "—",
    receipt_url: e.receipt_file_path
      ? (receiptUrls.get(e.receipt_file_path) ?? null)
      : null,
  }));

  const monthTotal = rows
    .filter((e) => e.expense_date >= monthStart)
    .reduce((sum, e) => sum + e.amount, 0);

  return <ExpensesClient expenses={rows} monthTotal={monthTotal} />;
}
