import { cookies } from "next/headers";
import { resolveLocale, type Locale } from "./i18n";
import { cache } from "react";

const LOCALE_COOKIE = "nexus_locale";

export const getRequestLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
});
