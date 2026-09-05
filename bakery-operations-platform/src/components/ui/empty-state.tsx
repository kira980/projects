import * as React from "react";
import { type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Friendly empty state: a soft icon, a short explanation of what the
 * section is for, and (optionally) one clear next action. Use inside a
 * card, a table's empty row, or a bare section.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="size-7" aria-hidden />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-[0.9375rem] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export { EmptyState };
