import { randomUUID } from "crypto";

/**
 * Stand-in for Supabase Storage.
 *
 * Production stores receipt and proof-of-delivery photos in private buckets
 * and hands out short-lived signed URLs. The demo keeps the same shape — an
 * upload returns a path, and a path can be exchanged for a viewable URL — but
 * nothing is written to disk: uploads are held in memory for the life of the
 * process and served back as a generated placeholder.
 *
 * That keeps every receipt/proof flow in the application clickable without the
 * repository ever containing an image of somebody's real invoice.
 */
type StoredFile = { bucket: string; path: string; name: string; type: string; size: number };

const globalRef = globalThis as unknown as { __demoFiles?: Map<string, StoredFile> };
const files = (globalRef.__demoFiles ??= new Map<string, StoredFile>());

function key(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

export function putFile(bucket: string, path: string, file: File): void {
  files.set(key(bucket, path), {
    bucket,
    path,
    name: file.name || `${randomUUID()}`,
    type: file.type || "application/octet-stream",
    size: file.size,
  });
}

export function getFile(bucket: string, path: string): StoredFile | undefined {
  return files.get(key(bucket, path));
}

/** The URL the UI will render. Served by the demo placeholder route. */
export function signedUrlFor(bucket: string, path: string): string {
  const params = new URLSearchParams({ bucket, path });
  return `/api/demo/file?${params.toString()}`;
}
