"use client";

import Link from "next/link";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkerDialog, PasscodeDialog, type WorkerRow } from "./worker-dialog";
import { DeviceDialog, type DeviceState } from "./device-dialog";
import { setWorkerActive } from "./actions";

export function WorkersTable({
  workers,
  devices,
}: {
  workers: WorkerRow[];
  /** Attendance phone per worker id — absent means never connected. */
  devices: Record<string, DeviceState>;
}) {
  async function onToggleActive(worker: WorkerRow, next: boolean) {
    const result = await setWorkerActive(worker.id, next);
    if (result.ok) {
      toast.success(next ? "העובד הופעל" : "העובד הושבת");
    } else {
      toast.error(result.error ?? "שגיאה");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">עובדים</h1>
        <WorkerDialog
          trigger={
            <Button>
              <Plus className="size-4" />
              עובד חדש
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>תפקידים</TableHead>
              <TableHead>קוד אישי</TableHead>
              <TableHead>נוכחות בטלפון</TableHead>
              <TableHead>פעיל</TableHead>
              <TableHead className="w-36">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  אין עובדים עדיין — הוסיפו עובד ראשון
                </TableCell>
              </TableRow>
            )}
            {workers.map((w) => (
              <TableRow key={w.id} className={w.is_active ? "" : "opacity-50"}>
                <TableCell>
                  <Link
                    href={`/dashboard/workers/${w.id}`}
                    className="font-medium hover:underline"
                  >
                    {w.full_name}
                  </Link>
                </TableCell>
                <TableCell dir="ltr" className="text-end">
                  {w.phone ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {w.is_admin && <Badge variant="secondary">מנהל</Badge>}
                    {w.can_manage_shift && <Badge variant="secondary">אחראי משמרת</Badge>}
                    {w.is_baker && <Badge variant="secondary">אופה</Badge>}
                    {w.is_driver && <Badge variant="secondary">נהג</Badge>}
                    {!w.is_admin && !w.can_manage_shift && !w.is_baker && !w.is_driver && (
                      <span className="text-muted-foreground">עובד</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {w.passcode_hash ? (
                    <Badge variant="outline">מוגדר</Badge>
                  ) : (
                    <Badge variant="destructive">חסר</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {/* Green connected, red when the worker is off, amber
                      when the phone was simply never set up. */}
                  {!w.is_active ? (
                    <Badge variant="destructive">מושבת</Badge>
                  ) : devices[w.id]?.connected ? (
                    <Badge variant="success">מחובר</Badge>
                  ) : (
                    <Badge variant="warning">דרוש חיבור</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={w.is_active}
                    onCheckedChange={(v) => onToggleActive(w, v)}
                    aria-label="פעיל"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <WorkerDialog
                      worker={w}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="עריכה">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <PasscodeDialog
                      workerId={w.id}
                      hasPasscode={!!w.passcode_hash}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="קוד אישי">
                          <KeyRound className="size-4" />
                        </Button>
                      }
                    />
                    <DeviceDialog
                      workerId={w.id}
                      workerName={w.full_name}
                      hasPhone={!!w.phone}
                      device={
                        devices[w.id] ?? { connected: false, connectedAt: null }
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
