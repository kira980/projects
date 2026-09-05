"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";
import { checkDayIsOpen } from "@/lib/db/day-lock";

export type ActionResult = { ok: boolean; error?: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * נשאר בקופה for a day.
 *
 * The takings themselves are gone from here — they are encrypted in the
 * owner's browser and stored where this server cannot read them. What is
 * left is the till, which the shift manager records at סיום יום from the
 * kiosk, and which the owner fixes here on the night nobody closed.
 *
 * The field is sent on every save, prefilled with what is on file: an
 * empty box therefore means "clear it", not "leave it alone".
 */
export async function saveDailySales(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const salesDate = String(formData.get("sales_date") ?? "");
  const leftRaw = String(formData.get("left_in_register") ?? "").trim();
  const left = leftRaw ? Number(leftRaw) : null;

  if (!DATE_RE.test(salesDate)) return { ok: false, error: "תאריך לא תקין" };
  if (left !== null && (isNaN(left) || left < 0)) {
    return { ok: false, error: "סכום נשאר בקופה לא תקין" };
  }

  if (!(await checkDayIsOpen(supabase, admin.business_id, salesDate))) {
    return { ok: false, error: "היום נעול — יש לפתוח אותו מחדש קודם" };
  }

  const { error } = await supabase.from("daily_sales").upsert(
    {
      business_id: admin.business_id,
      sales_date: salesDate,
      left_in_register: left,
      created_by: admin.id,
    },
    { onConflict: "business_id,sales_date" }
  );

  if (error) return { ok: false, error: "השמירה נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "daily_sales.save",
    entityType: "daily_sales",
    details: { sales_date: salesDate, left_in_register: left },
  });

  revalidatePath("/dashboard/simple");
  revalidatePath("/dashboard/simple/register");
  return { ok: true };
}

export async function closeDay(date: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!DATE_RE.test(date)) return { ok: false, error: "תאריך לא תקין" };

  const { error } = await supabase.from("day_locks").upsert(
    {
      business_id: admin.business_id,
      lock_date: date,
      is_locked: true,
      locked_by: admin.id,
      locked_at: new Date().toISOString(),
      reopened_by: null,
      reopened_at: null,
    },
    { onConflict: "business_id,lock_date" }
  );

  if (error) return { ok: false, error: "נעילת היום נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "day.lock",
    entityType: "day_lock",
    details: { date },
  });

  revalidatePath("/dashboard/simple");
  return { ok: true };
}

export async function reopenDay(date: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!DATE_RE.test(date)) return { ok: false, error: "תאריך לא תקין" };

  const { error } = await supabase
    .from("day_locks")
    .update({
      is_locked: false,
      reopened_by: admin.id,
      reopened_at: new Date().toISOString(),
    })
    .eq("business_id", admin.business_id)
    .eq("lock_date", date);

  if (error) return { ok: false, error: "פתיחת היום נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "day.reopen",
    entityType: "day_lock",
    details: { date },
  });

  revalidatePath("/dashboard/simple");
  return { ok: true };
}
