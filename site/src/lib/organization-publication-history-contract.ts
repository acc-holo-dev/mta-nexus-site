import { z } from "zod";
import { authorPublicationRestoreSchema } from "./author-publication-desk-contract";

const revision = authorPublicationRestoreSchema.shape.expectedRevision;
const state = z.enum(["draft", "published", "archived"]);
export const organizationPublicationHistorySchema = z
  .object({
    organization: z.object({ id: z.string().min(1).max(128), name: z.string() }).strict(),
    item: z
      .object({
        id: z.string().min(1).max(128),
        title: z
          .string()
          .max(400)
          .refine((value) => Array.from(value).length <= 200),
        status: state,
        revision,
        recoverable: z.boolean(),
      })
      .strict(),
    olderCursor: z.string().max(512).nullable(),
    events: z
      .array(
        z
          .object({
            id: z.string(),
            createdAt: revision,
            kind: z.enum(["created", "edited", "archived", "restored", "published"]),
            actor: z.enum(["author", "team", "moderation"]),
            from: state.nullable(),
            to: state.nullable(),
            identity: z.object({ username: z.string(), name: z.string() }).strict().nullable(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export function confirmedOrganizationPublicationRestore(
  value: unknown,
  id: string,
  organizationId: string,
  previous: string,
) {
  const parsed = z
    .object({
      id: z.literal(id),
      organizationId: z.literal(organizationId),
      status: z.literal("draft"),
      revision,
    })
    .strict()
    .safeParse(value);
  return parsed.success && parsed.data.revision > previous;
}
