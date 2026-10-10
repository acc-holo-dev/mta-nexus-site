import { z } from "zod";
const revision = z.number().int().min(0).max(2_147_483_646);
export const libraryReleaseCommandSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("latest"), expectedRevision: revision }).strict(),
  z
    .object({
      mode: z.literal("fixed"),
      expectedRevision: revision,
      buildId: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[A-Za-z0-9_-]+$/u),
    })
    .strict(),
]);
export const resourceModerationCommandSchema = z
  .object({
    action: z.enum(["suspend", "release"]),
    reason: z.string().trim().min(5).max(2000),
    expectedUpdatedAt: z
      .string()
      .datetime({ precision: 3, offset: false })
      .refine(
        (value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value,
      ),
  })
  .strict();
