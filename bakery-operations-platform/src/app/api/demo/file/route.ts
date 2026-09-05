import { NextResponse, type NextRequest } from "next/server";
import { getFile } from "@/lib/demo-backend/storage";

/**
 * Stands in for a signed Supabase Storage URL.
 *
 * The application uploads receipt and proof-of-delivery photos and then shows
 * them back. The demo keeps the round trip intact but serves a placeholder
 * instead of an image — the repository should never contain a picture of
 * anyone's invoice, and a demo does not need one to show the flow works.
 */
export async function GET(request: NextRequest) {
  const bucket = request.nextUrl.searchParams.get("bucket") ?? "";
  const path = request.nextUrl.searchParams.get("path") ?? "";
  const stored = getFile(bucket, path);

  const label = stored ? stored.name : "אסמכתא להדגמה";
  const detail = stored
    ? `${(stored.size / 1024).toFixed(0)} KB · ${stored.type}`
    : "הקובץ לא נשמר בין הפעלות";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440" role="img" aria-label="${escapeXml(label)}">
  <rect width="640" height="440" rx="16" fill="#f4f1ec"/>
  <rect x="24" y="24" width="592" height="392" rx="10" fill="#fff" stroke="#e2ddd5" stroke-width="2" stroke-dasharray="10 8"/>
  <g fill="#8a8175" font-family="system-ui, sans-serif" text-anchor="middle">
    <text x="320" y="196" font-size="26" font-weight="600">${escapeXml(label)}</text>
    <text x="320" y="232" font-size="15">${escapeXml(detail)}</text>
    <text x="320" y="286" font-size="13" fill="#a9a094">קבצים אינם נשמרים בגרסת ההדגמה</text>
  </g>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!
  );
}
