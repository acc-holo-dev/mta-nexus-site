"use client";

import { Languages } from "lucide-react";
import { getDictionary, type Locale } from "../lib/i18n";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const nextLocale: Locale = locale === "en" ? "ru" : "en";

  const switchLocale = () => {
    const secure =
      window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `nexus_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.location.reload();
  };

  return (
    <button
      type="button"
      onClick={switchLocale}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-base bg-elevated px-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] sm:px-2.5"
      aria-label={dictionary.locale.label}
      title={dictionary.locale.label}
    >
      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sm:hidden">{nextLocale.toUpperCase()}</span>
      <span className="hidden sm:inline">{dictionary.locale.switchTo}</span>
    </button>
  );
}
