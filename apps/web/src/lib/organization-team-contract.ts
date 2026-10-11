import { z } from "zod";
import { discussionCursorSchema } from "./content-discussion-contract";
import { organizationWorkspaceSchema } from "./organization-workspace-contract";
const cursorSchema = discussionCursorSchema
  .extend({ context: z.string().regex(/^[a-f0-9]{64}$/u), version: z.literal(1) })
  .strict();
export function parseOrganizationTeamQuery(params: URLSearchParams) {
  if (
    [...params.keys()].some(
      (key) => !["q", "role", "access", "cursor"].includes(key) || params.getAll(key).length !== 1,
    )
  )
    return null;
  const raw = params.get("q") ?? "",
    role = params.get("role") || undefined,
    access = params.get("access") || undefined;
  if (
    raw.length > 120 ||
    Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    (role && !["admin", "developer", "member", "other"].includes(role)) ||
    (access && !["yes", "no"].includes(access))
  )
    return null;
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (params.has("cursor")) {
    const value = params.get("cursor") ?? "";
    if (value.length > 512) return null;
    try {
      const result = cursorSchema.safeParse(JSON.parse(value));
      if (!result.success) return null;
      cursor = result.data;
    } catch {
      return null;
    }
  }
  return {
    query: raw.trim(),
    role: role as "admin" | "developer" | "member" | "other" | undefined,
    access: access as "yes" | "no" | undefined,
    cursor,
  };
}
type ParsedQuery = NonNullable<ReturnType<typeof parseOrganizationTeamQuery>>;
export type OrganizationTeamQuery = Pick<ParsedQuery, "query"> &
  Partial<Omit<ParsedQuery, "query">>;
export const organizationTeamPageSchema = organizationWorkspaceSchema
  .omit({ page: true })
  .extend({
    members: z
      .array(
        organizationWorkspaceSchema.shape.members.element
          .extend({ effectiveServerAccess: z.boolean() })
          .strict(),
      )
      .max(20),
    nextCursor: z.string().max(512).nullable(),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
export type OrganizationTeamPage = z.infer<typeof organizationTeamPageSchema>;
export function organizationTeamHref(
  id: string,
  filters: OrganizationTeamQuery,
  cursor?: string | null,
  api = false,
) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.role) params.set("role", filters.role);
  if (filters.access) params.set("access", filters.access);
  if (cursor) params.set("cursor", cursor);
  return `${api ? "/api" : ""}/workspace/organizations/${encodeURIComponent(id)}/team${params.size ? `?${params}` : ""}`;
}
