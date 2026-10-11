import { z } from "zod";
export const resourceReleaseWatchCommandSchema = z
  .object({
    enabled: z.boolean(),
    expectedRevision: z.number().int().min(0).max(2_147_483_646),
  })
  .strict();
