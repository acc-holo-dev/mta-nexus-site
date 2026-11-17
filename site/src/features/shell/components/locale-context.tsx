"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { getDictionary, type Locale } from "../../../lib/platform/i18n";

type LocaleContextValue = {
  locale: Locale;
  dictionary: ReturnType<typeof getDictionary>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dictionary: getDictionary(locale) }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useNexusLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useNexusLocale must be used inside LocaleProvider");
  }
  return value;
}
