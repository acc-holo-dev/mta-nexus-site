import { z } from "zod";
import { mtaVersionSchema } from "./mta-version";
const revision = z.number().int().min(1).max(2147483646);
const reason = z.string().trim().min(3).max(2000);
export const resourceBuildCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      expectedRevision: revision,
      releaseNotes: z.string().trim().max(10000),
      mtaVersionTarget: z
        .string()
        .trim()
        .pipe(mtaVersionSchema.or(z.literal(""))),
    })
    .strict(),
  z
    .object({
      action: z.enum(["withdraw", "submit", "retire"]),
      expectedRevision: revision,
      reason,
    })
    .strict(),
]);
