import { z } from "zod";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/u);
const revision = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
  .refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const reason = z.string().trim().min(5).max(1000);

export const licenseOwnerCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("bind"),
      serverId: identifier,
      expectedUpdatedAt: revision,
      reason,
    })
    .strict(),
  z.object({ action: z.literal("rotate_token"), expectedUpdatedAt: revision, reason }).strict(),
  z.object({ action: z.literal("revoke_token"), expectedUpdatedAt: revision, reason }).strict(),
  z.object({ action: z.literal("revoke"), expectedUpdatedAt: revision, reason }).strict(),
]);
export const licenseModerationCommandSchema = z
  .object({
    action: z.enum(["suspend", "restore", "revoke"]),
    expectedUpdatedAt: revision,
    reason,
  })
  .strict();
export const licenseRuntimeCheckSchema = z.object({ serverId: identifier }).strict();

export type LicenseOwnerCommand = z.infer<typeof licenseOwnerCommandSchema>;
export type LicenseModerationCommand = z.infer<typeof licenseModerationCommandSchema>;
