import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatMoney,
  formatDateTime,
  formatHours,
  formatDate,
  toTimeInput,
} from "@/lib/format";
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
import { WorkerDialog, PasscodeDialog } from "../worker-dialog";
import { ShiftEditRow } from "../shift-edit-row";
import { AdvanceEditRow } from "../advance-edit-row";

export const metadata = { title: "פרופיל עובד" };

export default async function WorkerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: worker } = await supabase
    .from("workers")
    .select("*")
    .eq("id", id)
    .eq("business_id", admin.business_id)
    .single();

  if (!worker) notFound();

  const [{ data: shifts }, { data: advances }, { data: audit }] =
    await Promise.all([
      supabase
        .from("worker_shifts")
        .select("id, started_at, ended_at, notes")
        .eq("worker_id", id)
        .order("started_at", { ascending: false })
        .limit(50),
      supabase
        .from("worker_advances")
        .select("id, amount, taken_at, given_by_type, given_by_id, notes")
        .eq("worker_id", id)
        .order("taken_at", { ascending: false })
        .limit(50),
      supabase
        .from("audit_logs")
        .select("id, action, actor_name, created_at, details")
        .eq("business_id", admin.business_id)
        .or(`entity_id.eq.${id},affected_worker_id.eq.${id},and(actor_type.eq.worker,actor_id.eq.${id})`)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const openShift = shifts?.find((s) => !s.ended_at);

  // Who gave each advance — resolve worker/admin ids to names.
  const giverWorkerIds = [
    ...new Set(
      (advances ?? [])
        .filter((a) => a.given_by_type === "worker" && a.given_by_id)
        .map((a) => a.given_by_id as string)
    ),
  ];
  const giverAdminIds = [
    ...new Set(
      (advances ?? [])
        .filter((a) => a.given_by_type === "admin" && a.given_by_id)
        .map((a) => a.given_by_id as string)
    ),
  ];
  const [{ data: giverWorkers }, { data: giverAdmins }] = await Promise.all([
    giverWorkerIds.length
      ? supabase.from("workers").select("id, full_name").in("id", giverWorkerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    giverAdminIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", giverAdminIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const giverNames = new Map<string, string>([
    ...(giverWorkers ?? []).map((w) => [w.id, w.full_name] as [string, string]),
    ...(giverAdmins ?? []).map((p) => [p.id, p.full_name] as [string, string]),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="חזרה">
          <Link href="/dashboard/workers">
            <ArrowRight className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{worker.full_name}</h1>
        {openShift ? (
          <Badge className="bg-green-600 hover:bg-green-600">במשמרת</Badge>
        ) : (
          <Badge variant="outline">לא במשמרת</Badge>
        )}
        {!worker.is_active && <Badge variant="destructive">לא פעיל</Badge>}
        <div className="ms-auto flex gap-2">
          <WorkerDialog worker={worker} trigger={<Button variant="outline">עריכה</Button>} />
          <PasscodeDialog
            workerId={worker.id}
            hasPasscode={!!worker.passcode_hash}
            trigger={<Button variant="outline">קוד אישי</Button>}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">טלפון</CardTitle>
          </CardHeader>
          <CardContent dir="ltr" className="text-end font-medium">
            {worker.phone ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">שכר שעתי</CardTitle>
          </CardHeader>
          <CardContent className="font-medium">
            {worker.hourly_rate ? formatMoney(worker.hourly_rate) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">תפקידים</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {worker.is_admin && <Badge variant="secondary">מנהל</Badge>}
            {worker.can_manage_shift && <Badge variant="secondary">אחראי משמרת</Badge>}
            {worker.is_baker && <Badge variant="secondary">אופה</Badge>}
            {worker.is_driver && <Badge variant="secondary">נהג</Badge>}
            {!worker.is_admin &&
              !worker.can_manage_shift &&
              !worker.is_baker &&
              !worker.is_driver &&
              "עובד"}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts">משמרות</TabsTrigger>
          <TabsTrigger value="advances">מפרעות</TabsTrigger>
          <TabsTrigger value="audit">יומן פעולות</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>כניסה</TableHead>
                  <TableHead>יציאה</TableHead>
                  <TableHead>שעות</TableHead>
                  <TableHead>הערות</TableHead>
                  <TableHead className="w-24">עדכון</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(shifts ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      אין משמרות עדיין
                    </TableCell>
                  </TableRow>
                )}
                {(shifts ?? []).map((s) => (
                  <ShiftEditRow
                    key={s.id}
                    shift={{
                      id: s.id,
                      startTime: toTimeInput(s.started_at),
                      endTime: s.ended_at ? toTimeInput(s.ended_at) : null,
                      hoursLabel: formatHours(s.started_at, s.ended_at),
                    }}
                    leading={<TableCell>{formatDate(s.started_at)}</TableCell>}
                    trailing={
                      <TableCell className="text-muted-foreground">
                        {s.notes ?? ""}
                      </TableCell>
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="advances">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סכום</TableHead>
                  <TableHead>ניתן ע&quot;י</TableHead>
                  <TableHead>הערות</TableHead>
                  <TableHead className="w-24">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(advances ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      אין מפרעות עדיין
                    </TableCell>
                  </TableRow>
                )}
                {(advances ?? []).map((a) => (
                  <AdvanceEditRow
                    key={a.id}
                    advance={{
                      id: a.id,
                      amount: Number(a.amount),
                      workerName: worker.full_name,
                    }}
                    leading={<TableCell>{formatDateTime(a.taken_at)}</TableCell>}
                    trailing={
                      <>
                        <TableCell>
                          {a.given_by_id
                            ? (giverNames.get(a.given_by_id) ??
                              (a.given_by_type === "admin" ? "מנהל" : "—"))
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.notes ?? ""}
                        </TableCell>
                      </>
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>זמן</TableHead>
                  <TableHead>פעולה</TableHead>
                  <TableHead>מבצע</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(audit ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                      אין פעולות עדיין
                    </TableCell>
                  </TableRow>
                )}
                {(audit ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDateTime(log.created_at)}</TableCell>
                    <TableCell dir="ltr" className="text-end font-mono text-xs">
                      {log.action}
                    </TableCell>
                    <TableCell>{log.actor_name}</TableCell>
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
