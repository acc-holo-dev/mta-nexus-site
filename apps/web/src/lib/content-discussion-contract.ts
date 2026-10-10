import { z } from "zod";
import { createContentCommentSchema } from "@nexus/validation";
export const discussionCommentSchema = createContentCommentSchema
  .extend({
    text: z.string().trim().min(2).max(5000),
    parentId: z.string().min(1).max(128).optional(),
  })
  .strict();
export const discussionCursorSchema = z
  .object({
    createdAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/u)
      .refine(
        (value) =>
          !value.startsWith("0000") &&
          Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 19) === value.slice(0, 19),
      ),
    id: z.string().min(1).max(128),
  })
  .strict();
export function parseDiscussionCursor(params: URLSearchParams) {
  const values = params.getAll("cursor");
  if (!values.length) return undefined;
  if (values.length !== 1 || values[0].length > 512) return null;
  try {
    const result = discussionCursorSchema.safeParse(JSON.parse(values[0]));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function encodeDiscussionCursor(cursor: z.infer<typeof discussionCursorSchema>) {
  return JSON.stringify(cursor);
}
const discussionItemSchema = z.object({
  id: z.string().min(1),
  revision: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  text: z.string(),
  parentId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  author: z
    .object({
      id: z.string(),
      username: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  parent: z.object({ text: z.string(), username: z.string().nullable() }).nullable(),
});
export const discussionPageSchema = z
  .object({
    items: z.array(discussionItemSchema).max(20),
    hasMore: z.boolean(),
    nextCursor: z.string().max(512).nullable(),
  })
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type DiscussionPage = z.infer<typeof discussionPageSchema>;
export const discussionEditSchema = z.object({
  text: z.string().trim().min(2).max(5000), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();
export const discussionRemoveSchema = discussionEditSchema.omit({ text: true }).extend({ reason: z.string().trim().max(1000).optional() }).strict();
