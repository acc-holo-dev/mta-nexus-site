import type { Locale } from "./i18n";
import { privateApiRequest } from "./private-api-request";
import { serverStatisticsError } from "./server-statistics-copy";

export async function fetchServerStatisticsCsv(url: string, locale: Locale, signal?: AbortSignal) {
  try {
    const response = await fetch(url, privateApiRequest({ timeoutMs: 15_000, signal }));
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const code = body && typeof body === "object" && "code" in body ? body.code : null;
      return { ok: false as const, error: serverStatisticsError(locale, code) };
    }
    if (response.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "text/csv")
      throw new Error();
    const blob = await response.blob();
    if (blob.size === 0 || blob.size > 128 * 1024) throw new Error();
    return { ok: true as const, blob };
  } catch {
    return { ok: false as const, error: serverStatisticsError(locale, "INTERNAL_ERROR") };
  }
}
