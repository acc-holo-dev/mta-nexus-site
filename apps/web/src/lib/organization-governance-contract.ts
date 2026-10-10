import { z } from "zod";
import type { EditableOrganization } from "./organization-workspace-contract";
import { editableOrganizationSchema } from "./organization-workspace-contract";

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
  nextCursor: identifier.nullable(),
});
export type OrganizationHistory = z.infer<typeof organizationHistorySchema>;
export function organizationHistoryCursor(params: URLSearchParams) {
  if ([...params.keys()].some((key) => key !== "before") || params.getAll("before").length > 1)
    return null;
  const before = params.get("before") || undefined;
  return before && !identifier.safeParse(before).success ? null : { before };
}
