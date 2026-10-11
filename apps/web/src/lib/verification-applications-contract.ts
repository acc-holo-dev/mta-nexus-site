import { safeExternalWebUrl } from "@nexus/validation";
import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
import {
  VERIFICATION_TYPES,
  verificationApplicationSchema,
} from "./verification-workspace-contract";

const exactTime = discussionCursorSchema.shape.createdAt.refine((value) =>
  /\.\d{6}Z$/u.test(value),
);
const cursor = discussionCursorSchema
  .extend({
    createdAt: exactTime,
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
    context: z.string().regex(/^[a-f0-9]{64}$/u),
    direction: z.enum(["older", "newer"]),
    version: z.literal(1),
  })
  .strict();
export const verificationApplicationAmendSchema = verificationApplicationSchema
  .pick({ proofUrl: true, notes: true })
  .extend({
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    proofUrl: verificationApplicationSchema.shape.proofUrl.refine(
      (value) => (safeExternalWebUrl(value)?.length ?? Infinity) <= 2048,
    ),
  })
  .strict();
export function parseVerificationApplicationsQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) => !["q", "status", "type", "cursor"].includes(key) || params.getAll(key).length !== 1,
    )
  )
    return null;
  const query = params.get("q") ?? "",
    status = params.get("status") || "all",
    type = params.get("type") || "all";
  if (
    query.length > 100 ||
    Array.from(query).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    !["all", "pending", "approved", "rejected"].includes(status) ||
    !(type === "all" || (VERIFICATION_TYPES as readonly string[]).includes(type))
  )
    return null;
  let point: z.infer<typeof cursor> | undefined;
  if (params.has("cursor")) {
    const raw = params.get("cursor") ?? "";
    if (raw.length > 512) return null;
    try {
      const result = cursor.safeParse(JSON.parse(raw));
      if (!result.success) return null;
      point = result.data;
    } catch {
      return null;
    }
  }
  return {
    query: query.trim(),
    status: status as "all" | "pending" | "approved" | "rejected",
    type: type as "all" | (typeof VERIFICATION_TYPES)[number],
    cursor: point,
  };
}
export type VerificationApplicationsQuery = NonNullable<
  ReturnType<typeof parseVerificationApplicationsQuery>
>;
export function verificationApplicationsHref(
  query: VerificationApplicationsQuery,
  point?: string | null,
) {
  const params = new URLSearchParams();
  if (query.query) params.set("q", query.query);
  if (query.status !== "all") params.set("status", query.status);
  if (query.type !== "all") params.set("type", query.type);
  if (point) params.set("cursor", point);
  return `/workspace/verification/history${params.size ? `?${params}` : ""}`;
}
export function confirmedVerificationApplicationAmend(
  value: unknown,
  id: string,
  previous: string,
) {
  const result = z
    .object({
      id: z.literal(id),
      status: z.literal("pending"),
      revision: z.string().regex(/^[a-f0-9]{64}$/u),
    })
    .strict()
    .safeParse(value);
  return result.success && result.data.revision !== previous;
}
