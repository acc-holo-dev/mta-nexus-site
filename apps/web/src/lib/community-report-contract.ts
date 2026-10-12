import { createReportSchema } from "@nexus/validation";
import { z } from "zod";
export const REPORT_TYPES = createReportSchema.shape.type.options;
const REPORT_STATUSES = ["open", "under_review", "resolved", "dismissed"] as const;
export const communityReportCreateSchema = createReportSchema
  .extend({
    targetType: z.enum(["content", "comment"]),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export const communityReportDecisionSchema = z
  .object({
    action: z.enum(["review", "resolve", "dismiss", "remove_comment"]),
    expectedStatus: z.enum(["open", "under_review"]),
    notes: z.string().trim().min(3).max(2000),
    expectedRevision: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
  })
  .strict()
  .refine((value) =>
    value.action === "remove_comment"
      ? !!value.expectedRevision
      : value.expectedRevision === undefined,
  );
export function parseCommunityReportQuery(params: URLSearchParams) {
  const allowed = ["view", "page", "target", "type", "q"];
  if (
    [...params.keys()].some((key) => !allowed.includes(key)) ||
    allowed.some((key) => params.getAll(key).length > 1)
  )
    return null;
  const view = params.get("view") || "pending",
    page = params.get("page") || "1";
  const target = params.get("target") || undefined,
    type = params.get("type") || undefined;
  const rawQuery = params.get("q") ?? "";
  if (
    !["pending", "history"].includes(view) ||
    !/^[1-9]\d{0,3}$/u.test(page) ||
    (target && !["content", "comment"].includes(target)) ||
    (type && !REPORT_TYPES.includes(type as (typeof REPORT_TYPES)[number])) ||
    rawQuery.length > 80
  )
    return null;
  return {
    view: view as "pending" | "history",
    page: Number(page),
    target: target as "content" | "comment" | undefined,
    type,
    ...(rawQuery.trim() ? { query: rawQuery.trim() } : {}),
  };
}
export type CommunityReportQuery = NonNullable<ReturnType<typeof parseCommunityReportQuery>>;
export function communityReportPageQuery(
  params: Record<string, string | string[] | undefined> = {},
) {
  const normalized = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const item of value) normalized.append(key, item);
    else if (value !== undefined) normalized.append(key, value);
  }
  return parseCommunityReportQuery(normalized);
}
const reportSummarySchema = z.object({
  id: z.string().min(1).max(128),
  targetType: z.enum(["content", "comment"]),
  targetId: z.string(),
  type: z.enum(REPORT_TYPES),
  reason: z.string(),
  evidenceUrls: z.array(z.string()).max(5),
  status: z.enum(REPORT_STATUSES),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export const communityReportPageSchema = z.object({
  items: z.array(reportSummarySchema).max(20),
  hasMore: z.boolean(),
  page: z.number().int().min(1).max(9999),
  view: z.enum(["pending", "history"]),
});
export const communityReportDetailSchema = reportSummarySchema.extend({
  target: z
    .object({
      kind: z.enum(["content", "comment"]),
      title: z.string(),
      text: z.string(),
      author: z.string().nullable(),
      status: z.string(),
      href: z
        .string()
        .regex(/^\/articles\//u)
        .nullable(),
      revision: z
        .string()
        .regex(/^[a-f0-9]{64}$/u)
        .nullable(),
      truncated: z.boolean(),
    })
    .nullable(),
  // Staff notes are never projected for the reporter.
  moderationHref: z
    .string()
    .regex(/^\/admin\/community\/[a-zA-Z0-9_-]+(?:\/discussion\/[a-zA-Z0-9_-]+)?$/u)
    .nullable()
    .optional(),
  moderatorNotes: z.string().nullable().optional(),
  reporterId: z.string().optional(),
});
export type CommunityReportPage = z.infer<typeof communityReportPageSchema>;
export type CommunityReportDetail = z.infer<typeof communityReportDetailSchema>;
export function confirmsReportDecision(
  value: unknown,
  reportId: string,
  action: z.infer<typeof communityReportDecisionSchema>["action"],
) {
  const parsed = z
    .object({
      id: z.literal(reportId),
      action: z.literal(action),
      status: z.literal(
        action === "review" ? "under_review" : action === "dismiss" ? "dismissed" : "resolved",
      ),
      removed: z.literal(action === "remove_comment"),
    })
    .safeParse(value);
  return parsed.success;
}
