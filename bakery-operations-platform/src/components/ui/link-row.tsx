"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A table row that navigates on click/Enter — the whole row is the touch
 * target, not just a small link. Clicks on nested links/buttons inside
 * the row are left alone.
 */
export function LinkRow({
  href,
  className,
  children,
  ...props
}: React.ComponentProps<typeof TableRow> & { href: string }) {
  const router = useRouter();

  function onClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) return;
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && e.target === e.currentTarget) {
      router.push(href);
    }
  }

  return (
    <TableRow
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn("cursor-pointer", className)}
      {...props}
    >
      {children}
    </TableRow>
  );
}
