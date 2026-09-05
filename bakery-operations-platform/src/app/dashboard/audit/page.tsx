import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  ACTION_LABELS,
  collectDetailIds,
  describeAudit,
  type NameLookup,
} from "./audit-details";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "יומן פעולות" };

const ACTOR_LABELS: Record<string, string> = {
  admin: "מנהל",
  worker: "עובד",
  customer: "לקוח",
  system: "מערכת",
};

/**
 * The ids sitting inside the details of the rows on screen, resolved to
 * names in one round trip per table — otherwise the details column would
 * have to either print raw uuids or drop them.
 */
async function lookupNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  ids: string[]
): Promise<NameLookup> {
  const names: NameLookup = new Map();
  if (ids.length === 0) return names;

  const [vendors, workers, customers, products] = await Promise.all([
    supabase.from("vendors").select("id, name").eq("business_id", businessId).in("id", ids),
    supabase.from("workers").select("id, full_name").eq("business_id", businessId).in("id", ids),
    supabase.from("customers").select("id, name").eq("business_id", businessId).in("id", ids),
    supabase.from("products").select("id, name").eq("business_id", businessId).in("id", ids),
  ]);

  for (const row of vendors.data ?? []) names.set(row.id, row.name);
  for (const row of workers.data ?? []) names.set(row.id, row.full_name);
  for (const row of customers.data ?? []) names.set(row.id, row.name);
  for (const row of products.data ?? []) names.set(row.id, row.name);
  return names;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const page = Math.max(1, Number(pageParam) || 1);
  const pageSize = 50;

  const { data: logs, count } = await supabase
    .from("audit_logs")
    .select("id, actor_type, actor_name, action, entity_type, details, created_at", {
      count: "exact",
    })
    .eq("business_id", admin.business_id)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  const names = await lookupNames(
    supabase,
    admin.business_id,
    [
      ...new Set(
        (logs ?? []).flatMap((log) =>
          collectDetailIds(log.details as Record<string, unknown> | null)
        )
      ),
    ]
  );

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">יומן פעולות</h1>
        <p className="text-muted-foreground">
          {count ?? 0} פעולות · עמוד {page} מתוך {totalPages}
        </p>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>זמן</TableHead>
              <TableHead>מבצע</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>פעולה</TableHead>
              <TableHead>פרטים</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logs ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  אין פעולות עדיין
                </TableCell>
              </TableRow>
            )}
            {(logs ?? []).map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(log.created_at)}
                </TableCell>
                <TableCell className="font-medium">{log.actor_name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {ACTOR_LABELS[log.actor_type] ?? log.actor_type}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {ACTION_LABELS[log.action] ?? log.action}
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {describeAudit(
                    log.action,
                    log.details as Record<string, unknown> | null,
                    names
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        {page > 1 && (
          <a
            href={`/dashboard/audit?page=${page - 1}`}
            className="text-sm text-primary hover:underline"
          >
            → עמוד קודם
          </a>
        )}
        {page < totalPages && (
          <a
            href={`/dashboard/audit?page=${page + 1}`}
            className="ms-auto text-sm text-primary hover:underline"
          >
            עמוד הבא ←
          </a>
        )}
      </div>
    </div>
  );
}
