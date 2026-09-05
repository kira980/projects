"use client";

import { createContext, useContext } from "react";
import type { Locale } from "./dictionary";
import { t as translate } from "./dictionary";

const LocaleContext = createContext<Locale>("he");

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

/** Returns { locale, t } — t() looks up the current locale automatically. */
export function useLocale() {
  const locale = useContext(LocaleContext);
  return { locale, t: (key: Parameters<typeof translate>[0]) => translate(key, locale) };
}
