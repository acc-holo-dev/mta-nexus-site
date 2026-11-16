import { z } from "zod";
import { ORDER_CASE_KINDS } from "@nexus/domain";
export const orderCaseCreateSchema = z
  .object({
    requestId: z.uuidv4(),
    kind: z.enum(ORDER_CASE_KINDS),
    subject: z.string().trim().min(5).max(120),
    message: z.string().trim().min(10).max(4000),
    requestedAmount: z.number().int().min(1).max(2147483647).nullable(),
  })
  .strict()
  .refine((v) =>
    v.kind === "refund_request"
      ? v.requestedAmount !== null
      : v.kind === "dispute" || v.requestedAmount === null,
  );
export const orderCaseReviewSchema = z
  .object({
    action: z.enum([
      "start_review",
      "request_info",
      "recommend_refund",
      "decline_refund",
      "resolve",
      "dismiss",
      "reopen",
    ]),
    expectedEvidenceHash: z.string().regex(/^[a-f0-9]{64}$/u),
    expectedRevision: z.number().int().min(1).max(2147483646),
    expectedSupportUpdatedAt: z.iso
      .datetime()
      .refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v),
    notes: z.string().trim().min(3).max(2000),
  })
  .strict();
