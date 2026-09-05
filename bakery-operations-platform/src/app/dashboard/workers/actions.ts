"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";
import {
  assertDayIsOpen,
  businessDayOf,
  jerusalemInstant,
  localInstantToday,
} from "@/lib/db/day-lock";
import { toDateInput, toTimeInput } from "@/lib/format";

export type ActionResult = { ok: boolean; error?: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

const PASSCODE_RE = /^\d{4}$/;

type WorkerInput = {
  full_name: string;
  phone: string | null;
  hourly_rate: number | null;
  pay_type: "hourly" | "monthly" | "daily";
  monthly_rate: number | null;
  daily_rate: number | null;
  can_manage_shift: boolean;
  is_admin: boolean;
  is_baker: boolean;
  is_driver: boolean;
  notes: string | null;
};

function parseWorkerForm(formData: FormData): WorkerInput | string {
  const full_name = String(formData.get("full_name") ?? "").trim();
  if (!full_name) return "יש להזין שם עובד";
  const rateRaw = String(formData.get("hourly_rate") ?? "").trim();
  const hourly_rate = rateRaw ? Number(rateRaw) : null;
  if (hourly_rate !== null && (isNaN(hourly_rate) || hourly_rate < 0)) {
    return "שכר שעתי לא תקין";
  }
  const payTypeRaw = String(formData.get("pay_type") ?? "hourly");
  const pay_type =
    payTypeRaw === "monthly"
      ? ("monthly" as const)
      : payTypeRaw === "daily"
        ? ("daily" as const)
        : ("hourly" as const);
  const monthlyRaw = String(formData.get("monthly_rate") ?? "").trim();
  const monthly_rate = monthlyRaw ? Number(monthlyRaw) : null;
  if (monthly_rate !== null && (isNaN(monthly_rate) || monthly_rate < 0)) {
    return "משכורת חודשית לא תקינה";
  }
  const dailyRaw = String(formData.get("daily_rate") ?? "").trim();
  const daily_rate = dailyRaw ? Number(dailyRaw) : null;
  if (daily_rate !== null && (isNaN(daily_rate) || daily_rate < 0)) {
    return "שכר יומי לא תקין";
  }
  return {
    full_name,
    phone: String(formData.get("phone") ?? "").trim() || null,
    hourly_rate,
    pay_type,
    monthly_rate,
    daily_rate,
    can_manage_shift: formData.get("can_manage_shift") === "on",
    is_admin: formData.get("is_admin") === "on",
    is_baker: formData.get("is_baker") === "on",
    is_driver: formData.get("is_driver") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createWorker(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseWorkerForm(formData);
  if (typeof input === "string") return fail(input);

  const passcode = String(formData.get("passcode") ?? "").trim();
  if (passcode && !PASSCODE_RE.test(passcode)) {
    return fail("קוד אישי חייב להיות 4–6 ספרות");
  }

  const { data: worker, error } = await supabase
    .from("workers")
    .insert({
      business_id: admin.business_id,
      ...input,
      passcode_hash: passcode ? await bcrypt.hash(passcode, 10) : null,
    })
    .select("id")
    .single();

  if (error) return fail("שמירת העובד נכשלה");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "worker.create",
    entityType: "worker",
    entityId: worker.id,
    details: { full_name: input.full_name },
  });

  revalidatePath("/dashboard/workers");
  return { ok: true };
}

export async function updateWorker(
  workerId: string,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const input = parseWorkerForm(formData);
  if (typeof input === "string") return fail(input);

  const { error } = await supabase
    .from("workers")
    .update(input)
    .eq("id", workerId)
    .eq("business_id", admin.business_id);

  if (error) return fail("עדכון העובד נכשל");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "worker.update",
    entityType: "worker",
    entityId: workerId,
    details: { full_name: input.full_name },
  });

  revalidatePath("/dashboard/workers");
  revalidatePath(`/dashboard/workers/${workerId}`);
  return { ok: true };
}

export async function setWorkerActive(
  workerId: string,
  isActive: boolean
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("workers")
    .update({ is_active: isActive })
    .eq("id", workerId)
    .eq("business_id", admin.business_id);

  if (error) return fail("עדכון הסטטוס נכשל");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: isActive ? "worker.activate" : "worker.deactivate",
    entityType: "worker",
    entityId: workerId,
  });

  revalidatePath("/dashboard/workers");
  revalidatePath(`/dashboard/workers/${workerId}`);
  return { ok: true };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateShifts(workerId: string) {
  revalidatePath("/dashboard/workers");
  revalidatePath(`/dashboard/workers/${workerId}`);
  revalidatePath("/dashboard/simple");
}

/**
 * Admin fixes a shift's clock times. The shift keeps the calendar date it
 * started on unless `date` moves it; an out time at or before the in time
 * is read as past midnight.
 *
 * An out time on a shift that is still open closes it — the admin's way of
 * finishing a shift the worker walked away from without clocking out.
 * Until this existed such a shift stayed open forever, growing against the
 * clock and blocking the worker's next clock-in (one open shift per worker).
 */
export async function updateShiftTimes(
  shiftId: string,
  startTime: string,
  endTime: string | null,
  date?: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!TIME_RE.test(startTime)) return fail("שעת כניסה לא תקינה");
  if (date && !DATE_RE.test(date)) return fail("תאריך לא תקין");

  const { data: shift } = await supabase
    .from("worker_shifts")
    .select("id, worker_id, started_at, ended_at")
    .eq("id", shiftId)
    .eq("business_id", admin.business_id)
    .maybeSingle();

  if (!shift) return fail("המשמרת לא נמצאה");

  const day = date ?? toDateInput(shift.started_at);
  const started_at = jerusalemInstant(day, startTime);

  const update: { started_at: string; ended_at?: string } = { started_at };
  const closing = !shift.ended_at && !!endTime;

  if (shift.ended_at || endTime) {
    if (!endTime || !TIME_RE.test(endTime)) return fail("שעת יציאה לא תקינה");
    let ended_at = jerusalemInstant(day, endTime);
    // Shifts run past midnight — an out time at or before the in time
    // belongs to the next calendar day.
    if (new Date(ended_at) <= new Date(started_at)) {
      ended_at = new Date(
        new Date(ended_at).getTime() + 24 * 3600_000
      ).toISOString();
    }
    if (
      new Date(ended_at).getTime() - new Date(started_at).getTime() >
      24 * 3600_000
    ) {
      return fail("משמרת ארוכה מ־24 שעות — יש להזין אותה במסך השעות");
    }
    update.ended_at = ended_at;
  }

  const { error } = await supabase
    .from("worker_shifts")
    .update(
      closing
        ? { ...update, ended_by_type: "admin", ended_by_id: admin.id }
        : update
    )
    .eq("id", shift.id)
    .eq("business_id", admin.business_id);

  if (error) return fail("עדכון שעות המשמרת נכשל");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: closing ? "shift.close_by_admin" : "shift.update_times",
    entityType: "worker_shift",
    entityId: shift.id,
    affectedWorkerId: shift.worker_id,
    details: {
      started_at: { from: shift.started_at, to: started_at },
      ...(update.ended_at
        ? { ended_at: { from: shift.ended_at, to: update.ended_at } }
        : {}),
    },
  });

  revalidateShifts(shift.worker_id);
  return { ok: true };
}

/**
 * Adds a shift the clock never recorded — the worker forgot to clock in,
 * or the whole day is missing.
 *
 * An out time at or before the in time is read as past midnight. An empty
 * out time leaves the shift open, which only makes sense for someone
 * actually at work right now.
 */
export async function createShift(
  workerId: string,
  date: string,
  startTime: string,
  endTime: string | null
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!DATE_RE.test(date)) return fail("תאריך לא תקין");
  if (!TIME_RE.test(startTime)) return fail("שעת כניסה לא תקינה");
  if (endTime && !TIME_RE.test(endTime)) return fail("שעת יציאה לא תקינה");

  const { data: worker } = await supabase
    .from("workers")
    .select("id, full_name")
    .eq("id", workerId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!worker) return fail("העובד לא נמצא");

  const started_at = jerusalemInstant(date, startTime);

  if (!endTime) {
    const { data: open } = await supabase
      .from("worker_shifts")
      .select("id")
      .eq("business_id", admin.business_id)
      .eq("worker_id", workerId)
      .is("ended_at", null)
      .maybeSingle();
    if (open) return fail(`ל${worker.full_name} כבר יש משמרת פתוחה`);

    const { data: created, error } = await supabase
      .from("worker_shifts")
      .insert({
        business_id: admin.business_id,
        worker_id: workerId,
        started_at,
        started_by_type: "admin",
        started_by_id: admin.id,
      })
      .select("id")
      .single();
    if (error) return fail("הוספת המשמרת נכשלה");

    await createAuditLog(supabase, {
      businessId: admin.business_id,
      actor: { type: "admin", id: admin.id, name: admin.full_name },
      action: "shift.create",
      entityType: "worker_shift",
      entityId: created.id,
      affectedWorkerId: workerId,
      details: { worker_name: worker.full_name, started_at },
    });

    revalidateShifts(workerId);
    return { ok: true };
  }

  let ended_at = jerusalemInstant(date, endTime);
  // A shift that runs past midnight ends on the next calendar day.
  if (Date.parse(ended_at) <= Date.parse(started_at)) {
    ended_at = new Date(Date.parse(ended_at) + 24 * 3600_000).toISOString();
  }

  const { data: created, error } = await supabase
    .from("worker_shifts")
    .insert({
      business_id: admin.business_id,
      worker_id: workerId,
      started_at,
      ended_at,
      started_by_type: "admin",
      started_by_id: admin.id,
      ended_by_type: "admin",
      ended_by_id: admin.id,
    })
    .select("id")
    .single();
  if (error) return fail("הוספת המשמרת נכשלה");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "shift.create",
    entityType: "worker_shift",
    entityId: created.id,
    affectedWorkerId: workerId,
    details: { worker_name: worker.full_name, started_at, ended_at },
  });

  revalidateShifts(workerId);
  return { ok: true };
}

/**
 * Ends an open shift — the סיום button next to a worker who is still
 * clocked in.
 *
 * `time` is an Israel-local HH:MM, defaulted by the UI to right now and
 * correctable there: someone finished at 22:00 and the office only gets
 * to it at 23:15. It is read as today's occurrence, and a reading still
 * ahead of the clock is refused rather than quietly taken to mean
 * yesterday. To close a shift at a time on another date, edit it in the
 * שעות screen, where the date is on screen.
 */
export async function stopShift(
  shiftId: string,
  time?: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (time && !TIME_RE.test(time)) return fail("שעה לא תקינה");

  const { data: shift } = await supabase
    .from("worker_shifts")
    .select("id, worker_id, started_at, ended_at")
    .eq("id", shiftId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!shift) return fail("המשמרת לא נמצאה");
  if (shift.ended_at) return fail("המשמרת כבר הסתיימה");

  let ended_at: string;
  if (time) {
    const resolved = localInstantToday(time);
    if (!resolved) {
      return fail(
        `השעה ${time} עוד לא הגיעה — השעה עכשיו ${toTimeInput(new Date())}`
      );
    }
    ended_at = resolved;
  } else {
    ended_at = new Date().toISOString();
  }

  if (Date.parse(ended_at) <= Date.parse(shift.started_at)) {
    return fail(
      `שעת היציאה לפני הכניסה (${toTimeInput(shift.started_at)})`
    );
  }
  const { error } = await supabase
    .from("worker_shifts")
    .update({ ended_at, ended_by_type: "admin", ended_by_id: admin.id })
    .eq("id", shift.id)
    .eq("business_id", admin.business_id);
  if (error) return fail("סיום המשמרת נכשל");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "shift.close_by_admin",
    entityType: "worker_shift",
    entityId: shift.id,
    affectedWorkerId: shift.worker_id,
    details: {
      started_at: { from: shift.started_at, to: shift.started_at },
      ended_at: { from: null, to: ended_at },
    },
  });

  revalidateShifts(shift.worker_id);
  return { ok: true };
}

export async function deleteShift(shiftId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: shift } = await supabase
    .from("worker_shifts")
    .select("id, worker_id, started_at, ended_at")
    .eq("id", shiftId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!shift) return fail("המשמרת לא נמצאה");

  const { error } = await supabase
    .from("worker_shifts")
    .delete()
    .eq("id", shift.id)
    .eq("business_id", admin.business_id);
  if (error) return fail("מחיקת המשמרת נכשלה");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "shift.delete",
    entityType: "worker_shift",
    entityId: shift.id,
    affectedWorkerId: shift.worker_id,
    details: { started_at: shift.started_at, ended_at: shift.ended_at },
  });

  revalidateShifts(shift.worker_id);
  return { ok: true };
}


/**
 * Admin corrections to an advance already on the books. Advances are money
 * out of the register, so both edits obey the day lock of the day the
 * advance was taken — not today's.
 */
async function findAdvance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  advanceId: string
) {
  const { data } = await supabase
    .from("worker_advances")
    .select("id, amount, worker_id, taken_at")
    .eq("id", advanceId)
    .eq("business_id", businessId)
    .maybeSingle();
  return data;
}

function revalidateAdvance(workerId: string) {
  revalidatePath("/dashboard/simple");
  revalidatePath("/dashboard/simple/payments");
  revalidatePath("/dashboard/workers");
  revalidatePath(`/dashboard/workers/${workerId}`);
}

/**
 * Records an advance the kiosk never got — one handed over on a day that
 * has already passed, or by the owner outside the tablet altogether.
 *
 * It is money out of the register on the day it is dated to, so that day's
 * lock is what governs, not today's. Time is optional; midday is a neutral
 * stand-in when nobody remembers the hour.
 */
export async function createAdvance(
  workerId: string,
  amountRaw: number,
  date: string,
  time?: string | null,
  notes?: string | null
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const amount = Number(amountRaw);
  if (!amount || isNaN(amount) || amount <= 0 || amount > 100000) {
    return fail("סכום לא תקין");
  }
  if (!DATE_RE.test(date)) return fail("תאריך לא תקין");
  if (time && !TIME_RE.test(time)) return fail("שעה לא תקינה");

  const { data: worker } = await supabase
    .from("workers")
    .select("id, full_name")
    .eq("id", workerId)
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (!worker) return fail("העובד לא נמצא");

  try {
    await assertDayIsOpen(supabase, admin.business_id, date);
  } catch (e) {
    return fail((e as Error).message);
  }

  const taken_at = jerusalemInstant(date, time || "12:00");

  const { data: advance, error } = await supabase
    .from("worker_advances")
    .insert({
      business_id: admin.business_id,
      worker_id: workerId,
      amount,
      method: "cash",
      taken_at,
      given_by_type: "admin",
      given_by_id: admin.id,
      notes: notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return fail("שמירת המפרעה נכשלה");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "advance.create",
    entityType: "worker_advance",
    entityId: advance.id,
    affectedWorkerId: workerId,
    details: {
      worker_name: worker.full_name,
      amount,
      taken_at,
      method: "cash",
    },
  });

  revalidateAdvance(workerId);
  return { ok: true };
}

export async function updateAdvance(
  advanceId: string,
  amountRaw: number
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const amount = Number(amountRaw);
  if (!amount || isNaN(amount) || amount <= 0 || amount > 100000) {
    return fail("סכום לא תקין");
  }

  const advance = await findAdvance(supabase, admin.business_id, advanceId);
  if (!advance) return fail("המפרעה לא נמצאה");

  try {
    await assertDayIsOpen(
      supabase,
      admin.business_id,
      businessDayOf(advance.taken_at)
    );
  } catch (e) {
    return fail((e as Error).message);
  }

  const { error } = await supabase
    .from("worker_advances")
    .update({ amount })
    .eq("id", advance.id)
    .eq("business_id", admin.business_id);

  if (error) return fail("עדכון המפרעה נכשל");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "advance.update",
    entityType: "worker_advance",
    entityId: advance.id,
    affectedWorkerId: advance.worker_id,
    details: { from: Number(advance.amount), to: amount },
  });

  revalidateAdvance(advance.worker_id);
  return { ok: true };
}

export async function deleteAdvance(advanceId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const advance = await findAdvance(supabase, admin.business_id, advanceId);
  if (!advance) return fail("המפרעה לא נמצאה");

  try {
    await assertDayIsOpen(
      supabase,
      admin.business_id,
      businessDayOf(advance.taken_at)
    );
  } catch (e) {
    return fail((e as Error).message);
  }

  const { error } = await supabase
    .from("worker_advances")
    .delete()
    .eq("id", advance.id)
    .eq("business_id", admin.business_id);

  if (error) return fail("מחיקת המפרעה נכשלה");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "advance.delete",
    entityType: "worker_advance",
    entityId: advance.id,
    affectedWorkerId: advance.worker_id,
    details: { amount: Number(advance.amount) },
  });

  revalidateAdvance(advance.worker_id);
  return { ok: true };
}

export async function setWorkerPasscode(
  workerId: string,
  passcode: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!PASSCODE_RE.test(passcode)) {
    return fail("קוד אישי חייב להיות 4–6 ספרות");
  }

  const { error } = await supabase
    .from("workers")
    .update({ passcode_hash: await bcrypt.hash(passcode, 10) })
    .eq("id", workerId)
    .eq("business_id", admin.business_id);

  if (error) return fail("עדכון הקוד נכשל");

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "worker.passcode_reset",
    entityType: "worker",
    entityId: workerId,
  });

  revalidatePath("/dashboard/workers");
  return { ok: true };
}
