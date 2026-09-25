import { cookies } from "next/headers";
import { resolveLocale, type Locale } from "./i18n";

export const LOCALE_COOKIE = "nexus_locale";

export async function getRequestLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
}
