"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePickerButton } from "@/components/date-picker-button";

/**
 * Prev/next navigation for date- or month-based reports (RTL aware).
 * Clicking the label opens a native date/month picker, so jumping far
 * doesn't require tapping the arrows repeatedly.
 */
export function ReportNav({
  basePath,
  param,
  current,
  prev,
  next,
  label,
  extraParams,
}: {
  basePath: string;
  param: string;
  current: string;
  prev: string;
  next: string;
  label: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function url(value: string) {
    // Preserve the current query — most importantly `period` — and change
    // only the navigated param. Rebuilding from just extraParams dropped
    // `period`, so picking a month (or using the arrows) fell back to the
    // default period (daily) and the month "turned into" a date.
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, val] of Object.entries(extraParams ?? {})) {
      params.set(key, val);
    }
    params.set(param, value);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" asChild aria-label="הקודם">
        <Link href={url(prev)}>
          <ChevronRight className="size-5" />
        </Link>
      </Button>
      <DatePickerButton
        // "month" params carry YYYY-MM values; everything else is a date.
        mode={param === "month" ? "month" : "date"}
        value={current}
        label={label}
        onPick={(value) => router.push(url(value))}
        className="min-w-32"
      />
      <Button variant="outline" size="icon" asChild aria-label="הבא">
        <Link href={url(next)}>
          <ChevronLeft className="size-5" />
        </Link>
      </Button>
    </div>
  );
}
