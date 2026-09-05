import Link from "next/link";
import { Button } from "@/components/ui/button";

export type ViewOption = { value: string; label: string };

/**
 * Link-based toggle between views of the same page (e.g. דוח / ניהול).
 * The first option is the default view (no query param). Server-safe.
 */
export function ViewToggle({
  basePath,
  options,
  current,
  param = "view",
}: {
  basePath: string;
  options: ViewOption[];
  current: string;
  param?: string;
}) {
  return (
    <div
      className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1"
      role="group"
      aria-label="בחירת תצוגה"
    >
      {options.map((o, i) => {
        const href = i === 0 ? basePath : `${basePath}?${param}=${o.value}`;
        const active = current === o.value;
        return (
          <Button
            key={o.value}
            asChild
            size="sm"
            variant={active ? "default" : "ghost"}
            className={active ? "" : "text-muted-foreground"}
            aria-current={active ? "page" : undefined}
          >
            <Link href={href}>{o.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}
