"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SearchableOption = { value: string; label: string };

/**
 * A select with type-to-search — for long lists (customers, products)
 * where a plain dropdown means endless scrolling. RTL-friendly, keyboard
 * accessible (arrows + Enter + Escape), closes on outside click.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "בחירה...",
  searchPlaceholder = "חיפוש...",
  emptyText = "לא נמצאו תוצאות",
  className,
}: {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlight, setHighlight] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggleOpen() {
    setOpen((o) => {
      if (!o) {
        setQuery("");
        setHighlight(0);
        // Focus the search box as soon as the list opens.
        setTimeout(() => searchRef.current?.focus(), 0);
      }
      return !o;
    });
  }

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) choose(opt.value);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-start text-[0.9375rem] transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
          !selected && "text-muted-foreground"
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-border">
          <div className="flex items-center gap-2 border-b px-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              aria-label={searchPlaceholder}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-sm text-muted-foreground">
                {emptyText}
              </li>
            )}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  // mousedown (not click) so the outside-click closer
                  // doesn't race us.
                  e.preventDefault();
                  choose(o.value);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-[0.9375rem]",
                  i === highlight && "bg-accent text-accent-foreground"
                )}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="size-4 shrink-0" aria-hidden />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
