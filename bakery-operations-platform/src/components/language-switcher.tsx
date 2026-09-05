"use client";

import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLocale } from "@/lib/i18n/locale-actions";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Locale } from "@/lib/i18n/dictionary";

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale } = useLocale();

  async function onChange(value: string) {
    await setLocale(value as Locale);
    router.refresh();
  }

  return (
    <Select value={locale} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-28 gap-1.5">
        <Globe className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="he">עברית</SelectItem>
        <SelectItem value="ar">العربية</SelectItem>
      </SelectContent>
    </Select>
  );
}
