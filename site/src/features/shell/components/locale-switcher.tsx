"use client";

import { Button } from "@nexus/ui";
import { Languages } from "lucide-react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { typeIcon35, typeSelectMinH11 } from "../type-shell";

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
      size="touch"
      onClick={switchLocale}
      className={typeSelectMinH11}
      aria-label={dictionary.locale.label}
      title={dictionary.locale.label}
    >
      <Languages className={typeIcon35} aria-hidden="true" />
      <span className="sm:hidden">{nextLocale.toUpperCase()}</span>
      <span className="hidden sm:inline">{dictionary.locale.switchTo}</span>
    </Button>
  );
}
