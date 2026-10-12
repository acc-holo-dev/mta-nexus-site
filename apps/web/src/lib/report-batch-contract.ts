import { z } from "zod";
import { REPORT_TYPES } from "./community-report-contract";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
  pending = z.enum(["open", "under_review"]);
export const reportBatchPreviewInput = z
  .object({
    items: z
      .array(z.object({ id, expectedStatus: pending }).strict())
      .min(1)
      .max(20)
      .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
    action: z.enum(["review", "resolve", "dismiss"]),
    notes: z
      .string()
      .trim()
      .min(3)
      .max(2000)
      .refine((value) => !value.includes("\0")),
  })
  .strict()
  .refine(
    (value) =>
      value.action !== "review" || value.items.every((item) => item.expectedStatus === "open"),
  );
export const reportBatchCommandInput = reportBatchPreviewInput
  .safeExtend({ previewRevision: z.string().regex(/^[a-f0-9]{64}$/u) })
  .strict();
const boundedText = (count: number) =>
  z
    .string()
    .max(count * 2)
    .refine((value) => Array.from(value).length <= count);
const status = z.enum(["under_review", "resolved", "dismissed"]);
const previewSchema = z
  .object({
    contentId: id,
    commentId: id,
    publication: z
      .object({ id, status: z.enum(["draft", "published", "archived"]), title: boundedText(200) })
      .strict(),
    comment: z
      .object({
        id,
        text: boundedText(5000),
        truncated: z.boolean(),
        revision: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict()
      .nullable(),
    action: reportBatchPreviewInput.shape.action,
    notes: reportBatchPreviewInput.shape.notes,
    previewRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    items: z
      .array(
        z
          .object({
            id,
            type: z.enum(REPORT_TYPES),
            reason: boundedText(1000),
            createdAt: z.iso.datetime(),
            before: pending,
            after: status,
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
const publicationPreviewSchema = previewSchema
  .extend({
    commentId: z.null(),
    comment: z.null(),
    publication: previewSchema.shape.publication
      .extend({ text: boundedText(5000), truncated: z.boolean() })
      .strict(),
  })
  .strict();
export type ReportBatchPreview =
  | z.infer<typeof previewSchema>
  | z.infer<typeof publicationPreviewSchema>;
const targetStatus = (action: z.infer<typeof reportBatchPreviewInput>["action"]) =>
  action === "review" ? "under_review" : action === "dismiss" ? "dismissed" : "resolved";
export function confirmsReportBatchPreview(
  value: unknown,
  contentId: string,
  commentId: string | null,
  input: z.infer<typeof reportBatchPreviewInput>,
) {
  const result = (commentId === null ? publicationPreviewSchema : previewSchema).safeParse(value);
  if (!result.success) return null;
  const data = result.data;
  if (
    data.contentId !== contentId ||
    data.commentId !== commentId ||
    data.publication.id !== contentId ||
    (data.comment && data.comment.id !== commentId) ||
    data.action !== input.action ||
    data.notes !== input.notes.trim() ||
    data.items.length !== input.items.length ||
    new Set(data.items.map((item) => item.id)).size !== data.items.length ||
    data.items.some(
      (item) =>
        input.items.find((expected) => expected.id === item.id)?.expectedStatus !== item.before ||
        item.after !== targetStatus(input.action) ||
        (input.action === "review" && item.before !== "open"),
    )
  )
    return null;
  return data;
}
export function confirmsReportBatchCommand(
  value: unknown,
  contentId: string,
  commentId: string | null,
  preview: ReportBatchPreview,
) {
  const parsed = z
    .object({
      contentId: z.literal(contentId),
      commentId: z.literal(commentId),
      action: z.literal(preview.action),
      previewRevision: z.literal(preview.previewRevision),
      items: z.array(z.object({ id, status }).strict()).min(1).max(20),
    })
    .strict()
    .safeParse(value);
  return (
    parsed.success &&
    parsed.data.items.length === preview.items.length &&
    new Set(parsed.data.items.map((item) => item.id)).size === parsed.data.items.length &&
    parsed.data.items.every((item) =>
      preview.items.some((expected) => expected.id === item.id && expected.after === item.status),
    )
  );
}
