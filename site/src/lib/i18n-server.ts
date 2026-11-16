import { cookies } from "next/headers";
import { cache } from "react";
import { type Locale, resolveLocale } from "./i18n";

const LOCALE_COOKIE = "nexus_locale";

export const getRequestCookieStore = cache(async () => cookies());

export const getRequestLocale = cache(async (): Promise<Locale> => {
  const store = await getRequestCookieStore();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
});
