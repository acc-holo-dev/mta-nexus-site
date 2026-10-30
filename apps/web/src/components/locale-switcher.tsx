"use client";

import { Button } from "@nexus/ui";
import { Languages } from "lucide-react";
import { getDictionary, type Locale } from "../lib/i18n";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const nextLocale: Locale = locale === "en" ? "ru" : "en";

  const switchLocale = () => {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    // biome-ignore lint/suspicious/noDocumentCookie: locale is a non-sensitive SameSite preference that must be written before reload.
    document.cookie = `nexus_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.location.reload();
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={switchLocale}
      className="h-8 shrink-0 gap-1.5 rounded-md border-base bg-elevated px-2 font-semibold sm:px-2.5"
      aria-label={dictionary.locale.label}
      title={dictionary.locale.label}
    >
      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sm:hidden">{nextLocale.toUpperCase()}</span>
      <span className="hidden sm:inline">{dictionary.locale.switchTo}</span>
    </Button>
  );
}
