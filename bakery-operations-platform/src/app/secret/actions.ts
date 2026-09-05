"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { createAuditLog } from "@/lib/db/audit";

/**
 * Storage for the encrypted takings.
 *
 * Everything here is deliberately blind: the server moves opaque strings in
 * and out and never holds a key, so these actions cannot read a single
 * figure even if they wanted to. That is the point — the threat is someone
 * with access to this database.
 *
 * The audit log records THAT a day was written, never what was in it.
 */

export type SecretResult = { ok: boolean; error?: string };

export type EncryptionSetup = {
  configured: boolean;
  salt: string;
  iterations: number;
  wrappedKey: string;
  hasRecovery: boolean;
  recoverySalt: string | null;
  recoveryWrappedKey: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Generous ceiling; the payload is a fixed-size padded blob. */
const MAX_CIPHER = 4096;

function looksLikeCipher(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_CIPHER &&
    /^[A-Za-z0-9+/=]+$/.test(value)
  );
}

export async function getEncryptionSetup(): Promise<EncryptionSetup> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("sales_encryption")
    .select("salt, iterations, wrapped_key, recovery_salt, recovery_wrapped_key")
    .eq("business_id", admin.business_id)
    .maybeSingle();

  return {
    configured: !!data,
    salt: data?.salt ?? "",
    iterations: data?.iterations ?? 0,
    wrappedKey: data?.wrapped_key ?? "",
    hasRecovery: !!data?.recovery_wrapped_key,
    recoverySalt: data?.recovery_salt ?? null,
    recoveryWrappedKey: data?.recovery_wrapped_key ?? null,
  };
}

/**
 * First run: store the wrapped data key. Refused if one already exists —
 * overwriting it would orphan every figure already encrypted under it.
 */
export async function initEncryption(
  salt: string,
  iterations: number,
  wrappedKey: string
): Promise<SecretResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!looksLikeCipher(salt) || !looksLikeCipher(wrappedKey)) {
    return { ok: false, error: "נתוני הצפנה לא תקינים" };
  }
  if (!Number.isInteger(iterations) || iterations < 100_000) {
    return { ok: false, error: "נתוני הצפנה לא תקינים" };
  }

  const { data: existing } = await supabase
    .from("sales_encryption")
    .select("business_id")
    .eq("business_id", admin.business_id)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "כבר הוגדרה סיסמה. לשינוי יש להשתמש בהחלפת סיסמה." };
  }

  const { error } = await supabase.from("sales_encryption").insert({
    business_id: admin.business_id,
    salt,
    iterations,
    wrapped_key: wrappedKey,
  });
  if (error) return { ok: false, error: "שמירת ההגדרה נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "secret.init",
    entityType: "sales_encryption",
  });

  revalidatePath("/secret");
  return { ok: true };
}

/**
 * Re-wrap the same data key under a new passphrase. The takings are not
 * touched, which is why changing the passphrase is instant.
 */
export async function changePassphrase(
  salt: string,
  iterations: number,
  wrappedKey: string
): Promise<SecretResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!looksLikeCipher(salt) || !looksLikeCipher(wrappedKey)) {
    return { ok: false, error: "נתוני הצפנה לא תקינים" };
  }

  const { error } = await supabase
    .from("sales_encryption")
    .update({ salt, iterations, wrapped_key: wrappedKey })
    .eq("business_id", admin.business_id);
  if (error) return { ok: false, error: "החלפת הסיסמה נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "secret.passphrase_change",
    entityType: "sales_encryption",
  });

  revalidatePath("/secret");
  return { ok: true };
}

/** Adds (or replaces) the recovery wrapping of the same data key. */
export async function setRecoveryWrapping(
  recoverySalt: string,
  recoveryWrappedKey: string
): Promise<SecretResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!looksLikeCipher(recoverySalt) || !looksLikeCipher(recoveryWrappedKey)) {
    return { ok: false, error: "נתוני שחזור לא תקינים" };
  }

  const { error } = await supabase
    .from("sales_encryption")
    .update({
      recovery_salt: recoverySalt,
      recovery_wrapped_key: recoveryWrappedKey,
    })
    .eq("business_id", admin.business_id);
  if (error) return { ok: false, error: "שמירת קוד השחזור נכשלה" };

  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "secret.recovery_set",
    entityType: "sales_encryption",
  });

  revalidatePath("/secret");
  return { ok: true };
}

/** One day's sealed takings. The server cannot tell what is inside. */
export async function saveDayCipher(
  date: string,
  cipher: string
): Promise<SecretResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!DATE_RE.test(date)) return { ok: false, error: "תאריך לא תקין" };
  if (!looksLikeCipher(cipher)) return { ok: false, error: "נתונים לא תקינים" };

  const { error } = await supabase.from("daily_sales").upsert(
    {
      business_id: admin.business_id,
      sales_date: date,
      sales_cipher: cipher,
      // Any legacy plaintext for this day goes when it is re-entered here.
      cash_total: 0,
      card_total: 0,
      other_total: 0,
      created_by: admin.id,
    },
    { onConflict: "business_id,sales_date" }
  );
  if (error) return { ok: false, error: "השמירה נכשלה" };

  // Deliberately no amounts in the audit trail — that would undo the point.
  await createAuditLog(supabase, {
    businessId: admin.business_id,
    actor: { type: "admin", id: admin.id, name: admin.full_name },
    action: "secret.day_save",
    entityType: "daily_sales",
    details: { sales_date: date },
  });

  revalidatePath("/secret");
  return { ok: true };
}

export type SealedDay = { date: string; cipher: string | null };

/** The sealed rows for a month, for the app to open in the browser. */
export async function listDayCiphers(
  from: string,
  to: string
): Promise<SealedDay[]> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return [];

  const { data } = await supabase
    .from("daily_sales")
    .select("sales_date, sales_cipher")
    .eq("business_id", admin.business_id)
    .gte("sales_date", from)
    .lte("sales_date", to)
    .order("sales_date", { ascending: false });

  return (data ?? []).map((r) => ({
    date: r.sales_date,
    cipher: r.sales_cipher,
  }));
}
