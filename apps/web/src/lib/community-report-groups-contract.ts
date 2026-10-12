import { CHANGE_HISTORY_PERIODS, type CommunityReportGroupFilters } from "@nexus/domain";
import { z } from "zod";
import { communityReportPageQuery, REPORT_TYPES } from "./community-report-contract";
import {
  changeHistoryHref,
  changeHistoryTimeSchema,
  parseChangeHistoryQuery,
} from "./private-change-history-query";
export function parseReportGroupsQuery(
  params: URLSearchParams,
): CommunityReportGroupFilters | null {
  const raw: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in raw || !["period", "view", "target", "type", "q", "cursor", "until"].includes(key))
      return null;
    raw[key] = value;
  }
  if (Array.from(raw.q ?? "").some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    return null;
  const view = raw.view ?? "pending",
    target = raw.target || undefined,
    type = raw.type || undefined;
  if (
    !["pending", "history"].includes(view) ||
    (target && !["content", "comment"].includes(target)) ||
    (type && !(REPORT_TYPES as readonly string[]).includes(type))
  )
    return null;
  const query = new URLSearchParams({ period: raw.period ?? "30" });
  for (const key of ["q", "cursor", "until"]) if (raw[key] !== undefined) query.set(key, raw[key]);
  const filters = parseChangeHistoryQuery(query, ["all"] as const, true);
  return filters
    ? {
        ...filters,
        view: view as "pending" | "history",
        target: target as "content" | "comment" | undefined,
        type,
      }
    : null;
}
export function reportGroupsHref(
  filters: CommunityReportGroupFilters,
  path = "/admin/reports/targets",
  options: { cursor?: string | null; until?: string; fresh?: boolean } = {},
) {
  const href = changeHistoryHref(path, filters, options),
    url = new URL(href, "https://nexus.local");
  url.searchParams.set("period", filters.period);
  url.searchParams.set("view", filters.view);
  if (filters.target) url.searchParams.set("target", filters.target);
  if (filters.type) url.searchParams.set("type", filters.type);
  return `${url.pathname}${url.search}`;
}
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u),
  boundedText = (count: number) =>
    z
      .string()
      .max(count * 2)
      .refine((value) => Array.from(value).length <= count),
  status = z.enum(["draft", "published", "archived"]),
  count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const reportGroupsPageSchema = z
  .object({
    period: z.enum(CHANGE_HISTORY_PERIODS),
    view: z.enum(["pending", "history"]),
    query: z.string().max(80),
    target: z.enum(["content", "comment"]).nullable(),
    type: z.enum(REPORT_TYPES).nullable(),
    until: changeHistoryTimeSchema,
    items: z
      .array(
        z
          .object({
            targetType: z.enum(["content", "comment"]),
            targetId: id,
            firstAt: changeHistoryTimeSchema,
            lastAt: changeHistoryTimeSchema,
            open: count,
            review: count,
            resolved: count,
            dismissed: count,
            reportHref: z.string().regex(/^\/admin\/reports\/[A-Za-z0-9_-]+$/u),
            target: z
              .object({
                contentId: id,
                title: boundedText(200),
                status,
                text: boundedText(160).nullable(),
              })
              .strict()
              .nullable(),
          })
          .strict(),
      )
      .max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().min(1).max(2048).nullable(),
  })
  .strict()
  .refine(
    (page) =>
      page.hasMore === (page.nextCursor !== null) &&
      (!page.hasMore || page.items.length === 20) &&
      page.items.every(
        (item) =>
          item.firstAt <= item.lastAt &&
          item.lastAt <= page.until &&
          (page.view === "pending"
            ? item.open + item.review > 0
            : item.resolved + item.dismissed > 0),
      ),
  );
export const publicationReportsPageSchema = z
  .object({
    publication: z
      .object({
        id,
        title: boundedText(200),
        status,
        text: boundedText(5000),
        truncated: z.boolean(),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            id,
            type: z.enum(REPORT_TYPES),
            reason: boundedText(1000),
            status: z.enum(["open", "under_review", "resolved", "dismissed"]),
            createdAt: z.iso.datetime(),
            resolvedAt: z.iso.datetime().nullable(),
          })
          .strict(),
      )
      .max(20),
    hasMore: z.boolean(),
    page: z.number().int().min(1).max(9999),
    view: z.enum(["pending", "history"]),
  })
  .strict();
export type ReportGroupsPage = z.infer<typeof reportGroupsPageSchema>;
export const publicationReportPageQuery = communityReportPageQuery;
