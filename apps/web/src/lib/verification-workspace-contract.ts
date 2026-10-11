import { externalWebUrlSchema, safeExternalWebUrl } from "@nexus/validation";
import { z } from "zod";
export const VERIFICATION_TYPES = ["user", "developer", "organization", "server"] as const;
export const developerProfileUpdateSchema = z
  .object({
    specialties: z
      .array(z.string().trim().min(2).max(50))
      .max(12)
      .transform((values) => [...new Set(values)]),
    githubUrl: externalWebUrlSchema
      .transform((value) => safeExternalWebUrl(value) ?? value)
      .or(z.literal("")),
    discordTag: z
      .string()
      .trim()
      .max(80)
      // biome-ignore lint/suspicious/noControlCharactersInRegex: Public contact text must reject literal control characters.
      .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value)),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();
export const editableDeveloperSchema = developerProfileUpdateSchema
  .omit({ expectedUpdatedAt: true })
  .extend({
    id: z.string(),
    verifiedDeveloper: z.boolean(),
    updatedAt: z.iso.datetime(),
  });
export const verificationApplicationSchema = z
  .object({
    targetType: z.enum(["user", "developer", "organization"]),
    targetId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
    proofUrl: externalWebUrlSchema,
    notes: z.string().trim().min(10).max(1000),
  })
  .strict();
export const verificationDecisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    reviewNotes: z.string().trim().min(3).max(2000),
    expectedApplicationRevision: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
  })
  .strict();
export function parseVerificationQuery(params: URLSearchParams, targets = false) {
  const allowed = targets ? ["page", "q"] : ["page", "view", "type"];
  if (
    [...params.keys()].some((key) => !allowed.includes(key)) ||
    allowed.some((key) => params.getAll(key).length > 1)
  )
    return null;
  const page = params.get("page") || "1",
    view = params.get("view") || "pending",
    type = params.get("type") || undefined,
    query = params.get("q") ?? "";
  if (
    !/^[1-9]\d{0,3}$/u.test(page) ||
    !["pending", "history"].includes(view) ||
    (type && !VERIFICATION_TYPES.includes(type as (typeof VERIFICATION_TYPES)[number])) ||
    query.length > 100
  )
    return null;
  return { page: Number(page), view: view as "pending" | "history", type, query: query.trim() };
}
export type VerificationQuery = NonNullable<ReturnType<typeof parseVerificationQuery>>;
export function verificationPageQuery(
  params: Record<string, string | string[] | undefined> = {},
  targets = false,
): VerificationQuery {
  const normalized = new URLSearchParams();
  for (const key of targets ? ["page", "q"] : ["page", "view", "type"]) {
    const value = params[key];
    if (value) normalized.set(key, Array.isArray(value) ? value[0] : value);
  }
  return (
    parseVerificationQuery(normalized, targets) ?? {
      page: 1,
      view: "pending",
      type: undefined,
      query: "",
    }
  );
}
export const verificationOverviewSchema = z.object({
  profile: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    role: z.string(),
    identityVerified: z.boolean(),
    experienceVerified: z.boolean(),
    hasSpecialties: z.boolean(),
    identityPending: z.boolean(),
    experiencePending: z.boolean(),
  }),
  history: z.object({
    items: z
      .array(
        z.object({
          id: z.string(),
          targetType: z.enum(VERIFICATION_TYPES),
          targetId: z.string(),
          status: z.enum(["pending", "approved", "rejected"]),
          proofUrl: z.string().nullable(),
          notes: z.string().nullable(),
          reviewNotes: z.string().nullable(),
          createdAt: z.iso.datetime(),
          resolvedAt: z.iso.datetime().nullable(),
        }),
      )
      .max(20),
    page: z.number().int().min(1).max(9999),
    view: z.enum(["pending", "history"]),
    hasMore: z.boolean(),
  }),
});
export const verificationTargetsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        verified: z.boolean(),
        pending: z.boolean(),
      }),
    )
    .max(20),
  page: z.number().int().min(1).max(9999),
  hasMore: z.boolean(),
});
export type VerificationOverview = z.infer<typeof verificationOverviewSchema>;
export type VerificationTargets = z.infer<typeof verificationTargetsSchema>;
export type EditableDeveloperProfile = z.infer<typeof editableDeveloperSchema>;
