import { z } from "zod";
import type { Locale } from "./i18n";
import {
  INBOX_CATEGORIES,
  INBOX_PERIODS,
  type NotificationInboxQuery,
  notificationInboxHref,
  notificationInboxPageSchema,
} from "./notification-inbox-contract";

export const INBOX_EXPORT_MAX_BYTES = 1024 * 1024;
export const INBOX_EXPORT_FILE_NAME = "nexus-notification-page.json";
const exportSchema = z
  .object({
    version: z.literal(1),
    scope: z.literal("notification-inbox-page"),
    locale: z.enum(["en", "ru"]),
    filters: z
      .object({
        query: z.string().max(100),
        state: z.enum(["all", "read", "unread"]),
        category: z.enum(["all", ...INBOX_CATEGORIES]),
        period: z.enum(INBOX_PERIODS),
      })
      .strict(),
    window: notificationInboxPageSchema.shape.window.unwrap().nullable(),
    items: z.array(notificationInboxPageSchema.shape.items.element.omit({ link: true })).max(25),
    hasOlder: z.boolean(),
    hasNewer: z.boolean(),
  })
  .strict();

export class NotificationInboxExportError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

/** Validate decoded bytes and the requested private page before offering a file. */
export async function fetchNotificationInboxExport(
  filters: NotificationInboxQuery,
  locale: Locale,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<Blob> {
  signal.throwIfAborted();
  const expected = {
    query: filters.query,
    state: filters.state,
    category: filters.category,
    period: filters.period ?? "all",
    at: filters.at ?? filters.cursor?.asOf,
    locale,
  };
  const href = notificationInboxHref(
    "/api/notifications/inbox/export",
    filters,
    filters.cursor ? JSON.stringify(filters.cursor) : undefined,
  );
  const response = await request(href, {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    signal,
  });
  const cancelBody = () => {
    void response.body?.cancel().catch(() => undefined);
  };
  if (!response.ok) {
    cancelBody();
    const codes: Record<number, string> = {
      400: "VALIDATION_ERROR",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      413: "EXPORT_TOO_LARGE",
      429: "RATE_LIMIT_EXCEEDED",
    };
    throw new NotificationInboxExportError(codes[response.status] ?? "EXPORT_FAILED");
  }
  const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  const length = response.headers.get("content-length");
  const encoding = response.headers.get("content-encoding")?.toLowerCase();
  const declared = !encoding || encoding === "identity" ? length : null;
  if (
    response.status !== 200 ||
    response.redirected ||
    mime !== "application/json" ||
    response.headers.get("content-disposition") !==
      `attachment; filename="${INBOX_EXPORT_FILE_NAME}"` ||
    (declared !== null && (!/^\d+$/u.test(declared) || !Number.isSafeInteger(Number(declared))))
  ) {
    cancelBody();
    throw new NotificationInboxExportError("EXPORT_FAILED");
  }
  if (declared !== null && Number(declared) > INBOX_EXPORT_MAX_BYTES) {
    cancelBody();
    throw new NotificationInboxExportError("EXPORT_TOO_LARGE");
  }
  if (!response.body) throw new NotificationInboxExportError("EXPORT_FAILED");
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const bytes = new Uint8Array(INBOX_EXPORT_MAX_BYTES);
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      if (!value.byteLength) continue;
      size += value.byteLength;
      if (size > INBOX_EXPORT_MAX_BYTES) throw new NotificationInboxExportError("EXPORT_TOO_LARGE");
      bytes.set(value, size - value.byteLength);
    }
    if (!size || (declared !== null && size !== Number(declared)))
      throw new NotificationInboxExportError("EXPORT_FAILED");
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }

  let report: z.infer<typeof exportSchema>;
  try {
    report = exportSchema.parse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size))),
    );
  } catch {
    throw new NotificationInboxExportError("EXPORT_FAILED");
  }
  signal.throwIfAborted();
  if (
    report.locale !== expected.locale ||
    report.filters.query !== expected.query ||
    report.filters.state !== expected.state ||
    report.filters.category !== expected.category ||
    report.filters.period !== expected.period ||
    (expected.period === "all" ? report.window !== null : !report.window) ||
    (expected.at !== undefined && report.window?.until !== expected.at) ||
    new Set(report.items.map((item) => item.id)).size !== report.items.length ||
    report.items.some(
      (item) =>
        (expected.state !== "all" && item.isRead !== (expected.state === "read")) ||
        (expected.category !== "all" && item.category !== expected.category) ||
        (report.window !== null &&
          (item.createdAt < report.window.from || item.createdAt > report.window.until)),
    )
  )
    throw new NotificationInboxExportError("EXPORT_FAILED");
  return new Blob([bytes.slice(0, size)], { type: "application/json" });
}
