import "server-only";
import type { SupabaseClient } from "@/lib/demo-backend/types";
import { randomUUID } from "crypto";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/**
 * Uploads a receipt/proof file to a private bucket under
 * {businessId}/{folder}/{uuid}.{ext} and registers it in
 * uploaded_files. Returns the storage path, or null when no file
 * was provided. Throws with a Hebrew message on invalid files.
 */
export async function uploadBusinessFile(
  supabase: SupabaseClient,
  opts: {
    businessId: string;
    bucket: "receipts" | "proofs" | "documents";
    folder: string;
    file: File | null;
    entityType?: string;
    entityId?: string;
    uploadedByType: "admin" | "worker" | "system";
    uploadedById?: string;
  }
): Promise<string | null> {
  const { file } = opts;
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("הקובץ גדול מדי (מקסימום 10MB)");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("סוג קובץ לא נתמך — יש להעלות תמונה או PDF");
  }

  const ext = file.type === "application/pdf" ? "pdf" : (file.type.split("/")[1] ?? "jpg");
  const path = `${opts.businessId}/${opts.folder}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(opts.bucket)
    .upload(path, file, { contentType: file.type });

  if (error) {
    console.error("upload failed:", error.message);
    throw new Error("העלאת הקובץ נכשלה");
  }

  await supabase.from("uploaded_files").insert({
    business_id: opts.businessId,
    bucket: opts.bucket,
    path,
    entity_type: opts.entityType ?? null,
    entity_id: opts.entityId ?? null,
    uploaded_by_type: opts.uploadedByType,
    uploaded_by_id: opts.uploadedById ?? null,
  });

  return path;
}

/** Signed URL (1 hour) for viewing a private file. */
export async function getSignedFileUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/**
 * Signed URLs (1 hour) for many private files in ONE storage round trip.
 * Returns path → url; paths that failed to sign are simply absent.
 */
export async function getSignedFileUrls(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, 3600);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      urls.set(item.path, item.signedUrl);
    }
  }
  return urls;
}
