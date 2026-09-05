import type { SupabaseClient } from "@/lib/demo-backend/types";

export type AuditActor =
  | { type: "admin"; id: string; name: string }
  | { type: "worker"; id: string; name: string }
  | { type: "customer"; id: string; name: string }
  | { type: "system"; id?: undefined; name: string };

export type AuditEntry = {
  businessId: string;
  actor: AuditActor;
  /** e.g. "shift.start", "vendor_order.create", "day.lock" */
  action: string;
  entityType?: string;
  entityId?: string;
  /** Worker acted upon (e.g. shift manager clocking someone else). */
  affectedWorkerId?: string;
  details?: Record<string, unknown>;
};

/**
 * Appends an audit log row. Never throws — auditing must not break
 * the action itself; failures are logged to the server console.
 */
export async function createAuditLog(
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    business_id: entry.businessId,
    actor_type: entry.actor.type,
    actor_id: entry.actor.id ?? null,
    actor_name: entry.actor.name,
    affected_worker_id: entry.affectedWorkerId ?? null,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    details: entry.details ?? {},
  });
  if (error) {
    console.error("audit log failed:", entry.action, error.message);
  }
}
