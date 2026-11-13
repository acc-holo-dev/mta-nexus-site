import {
  CHANGE_HISTORY_PERIODS,
  REPORT_HISTORY_ACTIONS,
  REPORT_HISTORY_GROUPS,
} from "@nexus/domain";
import { z } from "zod";
import { REPORT_TYPES } from "./community-report-contract";
import { changeHistoryTimeSchema, parseChangeHistoryQuery } from "./private-change-history-query";
export const parseReportHistoryQuery = (params: URLSearchParams) =>
  parseChangeHistoryQuery(params, REPORT_HISTORY_GROUPS);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/u);
const status = z.enum(["open", "under_review", "resolved", "dismissed"]);
const event = z
  .object({
    id,
    action: z.enum(REPORT_HISTORY_ACTIONS),
    createdAt: changeHistoryTimeSchema,
    from: status.nullable(),
    to: status.nullable(),
    by: z.enum(["requester", "staff", "unknown"]),
    removed: z.boolean(),
  })
  .strict();
const fields = {
  report: z
    .object({ id, targetType: z.enum(["content", "comment"]), type: z.enum(REPORT_TYPES), status })
    .strict(),
  period: z.enum(CHANGE_HISTORY_PERIODS),
  group: z.enum(REPORT_HISTORY_GROUPS),
  until: changeHistoryTimeSchema,
  hasMore: z.boolean(),
  nextCursor: z.string().min(1).max(2048).nullable(),
};
export const reportHistoryPageSchema = z
  .discriminatedUnion("audience", [
    z
      .object({ ...fields, audience: z.literal("requester"), items: z.array(event).max(20) })
      .strict(),
    z
      .object({
        ...fields,
        audience: z.literal("staff"),
        items: z
          .array(
            event
              .extend({
                notes: z.string().max(2000).nullable(),
                batchSize: z.number().int().min(1).max(20).nullable(),
              })
              .strict(),
          )
          .max(20),
      })
      .strict(),
  ])
  .refine(
    (page) =>
      page.hasMore === (page.nextCursor !== null) && (!page.hasMore || page.items.length === 20),
  );
export type ReportHistoryPage = z.infer<typeof reportHistoryPageSchema>;
