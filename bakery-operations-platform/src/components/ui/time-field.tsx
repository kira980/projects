"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A complete clock reading, 24-hour. */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Keeps a typed clock reading in HH:MM as the digits come in: "1" → "1",
 * "13" → "13", "134" → "13:4". Backspacing walks it back the same way.
 */
export function formatTimeTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * A clock time, typed as four digits.
 *
 * Deliberately NOT <input type="time">: that widget renders in the
 * browser's own locale, so on a 12-hour machine every field reads back as
 * "12:30 PM" and an empty one shows a 12-hour placeholder — hours the
 * business never worked. Typing four digits is also faster than the OS
 * clock wheel on a tablet, which is why the kiosk always did it this way.
 *
 * The value is always 24-hour HH:MM, matching what the server expects.
 */
export function TimeField({
  value,
  onChange,
  className,
  ...props
}: {
  value: string;
  onChange: (value: string) => void;
} & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
>) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(formatTimeTyping(e.target.value))}
      inputMode="numeric"
      placeholder="--:--"
      maxLength={5}
      dir="ltr"
      className={cn("text-center tabular-nums", className)}
      {...props}
    />
  );
}
