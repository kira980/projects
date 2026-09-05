"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Client-side CSV download (UTF-8 BOM so Excel opens Hebrew correctly). */
export function ExportCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  function download() {
    const escape = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv =
      "﻿" +
      [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download className="size-4" />
      ייצוא CSV
    </Button>
  );
}
