import { RESOURCE_MEDIA_LIMIT } from "@nexus/domain";
import { z } from "zod";
export const resourceMediaIdSchema = z.string().regex(/^rmi_[A-Za-z0-9_-]{1,100}$/u);
export const resourceMediaCaptionSchema = z
  .string()
  .trim()
  .max(160)
  .refine(
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Captions are single-line text.
    (value) => !/[\u0000-\u001f\u007f\p{Cf}]/u.test(value),
    "Use a single-line caption",
  );
export const resourceMediaRevisionSchema = z.iso.datetime({ offset: true });
export const resourceMediaCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      expectedUpdatedAt: resourceMediaRevisionSchema,
      items: z
        .array(
          z.object({ id: resourceMediaIdSchema, caption: resourceMediaCaptionSchema }).strict(),
        )
        .max(RESOURCE_MEDIA_LIMIT)
        .refine((items) => new Set(items.map((v) => v.id)).size === items.length),
    })
    .strict(),
  z
    .object({
      action: z.literal("remove"),
      expectedUpdatedAt: resourceMediaRevisionSchema,
      mediaId: resourceMediaIdSchema,
    })
    .strict(),
]);
export type ResourceMediaCommand = z.infer<typeof resourceMediaCommandSchema>;
