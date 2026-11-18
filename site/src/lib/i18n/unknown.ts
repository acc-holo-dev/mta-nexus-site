import { getDictionary, type Locale } from "./index";

/** Shared unknown/empty marker for bilingual honesty surfaces. */
export function unknownMarker(locale: Locale): string {
  return getDictionary(locale).errors.unknownMarker;
}

/** Prefer a present value; otherwise the locale unknown marker. */
export function formatUnknown(locale: Locale, value: string | number | null | undefined): string {
  if (value == null) return unknownMarker(locale);
  const text = typeof value === "string" ? value.trim() : String(value);
  return text.length > 0 ? text : unknownMarker(locale);
}
