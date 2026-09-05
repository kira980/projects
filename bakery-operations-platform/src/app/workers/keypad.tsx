"use client";

import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Big tablet-friendly numeric keypad. */
export function Keypad({
  onDigit,
  onBackspace,
  onClear,
  disabled,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-3" dir="ltr">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
        <Button
          key={d}
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-16 text-2xl font-semibold"
          onClick={() => onDigit(d)}
        >
          {d}
        </Button>
      ))}
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        className="h-16 text-sm"
        onClick={onClear}
      >
        נקה
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className="h-16 text-2xl font-semibold"
        onClick={() => onDigit("0")}
      >
        0
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        className="h-16"
        onClick={onBackspace}
        aria-label="מחיקה"
      >
        <Delete className="size-6" />
      </Button>
    </div>
  );
}
