import { CHANGE_HISTORY_PERIODS, ORGANIZATION_CHANGE_GROUPS } from "@nexus/domain";
import { z } from "zod";
import type { EditableOrganization } from "./organization-workspace-contract";
import { editableOrganizationSchema } from "./organization-workspace-contract";
import { changeHistoryTimeSchema, parseChangeHistoryQuery } from "./private-change-history-query";

const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u);
export const ownershipTransferSchema = z
  .object({
    targetId: identifier,
    targetUsername: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9_-]+$/u),
    confirmationSlug: z.string().min(3).max(80),
    // ORG-003: current password is a fresh-auth proof; never stored after the request.
    currentPassword: z.string().min(1).max(128),
    formerOwnerRole: z.enum(["member", "admin"]),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();
export const ownershipTransferResultSchema = z.object({
  organization: editableOrganizationSchema,
  role: z.enum(["member", "admin"]),
  owner: z.object({
    id: identifier,
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  previousOwnerId: identifier,
});
export function confirmOwnershipTransfer(
  value: unknown,
  previous: EditableOrganization,
  actorId: string,
  input: z.infer<typeof ownershipTransferSchema>,
) {
  const result = ownershipTransferResultSchema.safeParse(value);
  if (
    !result.success ||
    result.data.organization.id !== previous.id ||
    result.data.organization.slug !== previous.slug ||
    result.data.organization.ownerId !== input.targetId ||
    result.data.owner.id !== input.targetId ||
    result.data.owner.username !== input.targetUsername ||
    result.data.previousOwnerId !== actorId ||
    result.data.role !== input.formerOwnerRole ||
    Date.parse(result.data.organization.updatedAt) <= Date.parse(previous.updatedAt) ||
    (["name", "description", "logoUrl", "websiteUrl", "isVerified"] as const).some(
      (field) => result.data.organization[field] !== previous[field],
    )
  )
    return null;
  return result.data;
}
const organizationHistoryActions = [
  "organization.created",
  "organization.profile_updated",
  "organization.member_added",
  "organization.member_updated",
  "organization.member_removed",
  "organization.member_left",
  "organization.ownership_transferred",
] as const;
export const organizationHistorySchema = z.object({
  organization: z.object({ id: identifier, name: z.string(), slug: z.string() }),
  items: z
    .array(
      z.object({
        id: identifier,
        action: z.enum(organizationHistoryActions),
        createdAt: z.iso.datetime(),
        actorUsername: z.string().nullable(),
        actorName: z.string().nullable(),
        subjectUsername: z.string().nullable(),
        subjectName: z.string().nullable(),
        fromRole: z.enum(["owner", "admin", "developer", "member"]).nullable(),
        toRole: z.enum(["owner", "admin", "developer", "member"]).nullable(),
        managesServers: z.boolean().nullable(),
        fields: z.array(z.enum(["name", "description", "logoUrl", "websiteUrl"])).max(4),
      }),
    )
    .max(20),
  hasMore: z.boolean(),
  nextCursor: z
    .string()
    .max(2048)
    .regex(/^[A-Za-z0-9_-]+$/u)
    .nullable(),
  until: changeHistoryTimeSchema.optional(),
  period: z.enum(CHANGE_HISTORY_PERIODS).optional(),
  group: z.enum(ORGANIZATION_CHANGE_GROUPS).optional(),
  query: z.string().max(80).optional(),
});
export type OrganizationHistory = z.infer<typeof organizationHistorySchema>;
export function organizationHistoryCursor(params: URLSearchParams) {
  if ([...params.keys()].some((key) => key !== "before") || params.getAll("before").length > 1)
    return null;
  const before = params.get("before") || undefined;
  return before && !identifier.safeParse(before).success ? null : { before };
}

export function parseOrganizationChangeHistoryQuery(params: URLSearchParams) {
  if ([...params.keys()].every((key) => key === "before") && !organizationHistoryCursor(params))
    return null;
  return parseChangeHistoryQuery(params, ORGANIZATION_CHANGE_GROUPS, true, true);
}

export const organizationChangeHistorySchema = organizationHistorySchema
  .extend({
    organization: z
      .object({ id: identifier, name: z.string().max(200), slug: z.string().max(128) })
      .strict(),
    items: organizationHistorySchema.shape.items.element
      .extend({ createdAt: changeHistoryTimeSchema })
      .array()
      .max(20),
    until: changeHistoryTimeSchema,
    period: z.enum(CHANGE_HISTORY_PERIODS),
    group: z.enum(ORGANIZATION_CHANGE_GROUPS),
    query: z.string().max(80),
  })
  .strict()
  .refine((value) => value.hasMore === (value.nextCursor !== null));
