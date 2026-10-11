import { z } from "zod";
const badge = z
  .object({ verified: z.boolean(), latestRecordedApprovalAt: z.iso.datetime().nullable() })
  .strict();
const owned = z
  .object({ total: z.number().int().nonnegative(), verified: z.number().int().nonnegative() })
  .strict()
  .refine((value) => value.verified <= value.total);
export const publicUserTrustSchema = z
  .object({
    user: z
      .object({
        username: z.string(),
        displayName: z.string(),
        avatarUrl: z.string().nullable(),
        joinedAt: z.iso.datetime(),
      })
      .strict(),
    identity: badge,
    developer: badge,
    servers: owned,
    organizations: owned,
    publications: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type PublicUserTrust = z.infer<typeof publicUserTrustSchema>;
