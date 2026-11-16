import { organizationTeamRoles } from "@nexus/domain";
import { z } from "zod";
import { editableOrganizationSchema } from "./organization-workspace-contract";

const ids = z
  .array(z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u))
  .min(1)
  .max(20)
  .refine((value) => new Set(value).size === value.length);
const change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: z.enum(organizationTeamRoles) }).strict(),
  z.object({ action: z.literal("server_access"), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal("remove") }).strict(),
]);
export const organizationBatchPreviewInput = z
  .object({
    userIds: ids,
    change,
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();
export const organizationBatchCommandInput = organizationBatchPreviewInput
  .extend({
    previewRevision: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();
const access = z
  .object({
    role: z.string().min(1).max(128),
    managesServers: z.boolean(),
    effectiveServerAccess: z.boolean(),
  })
  .strict();
const organizationBatchPreviewSchema = z
  .object({
    organizationId: z.string().min(1).max(128),
    expectedUpdatedAt: z.iso.datetime(),
    previewRevision: z.string().regex(/^[a-f0-9]{64}$/u),
    changedCount: z.number().int().min(0).max(20),
    members: z
      .array(
        z
          .object({
            userId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/u),
            username: z.string(),
            displayName: z.string(),
            before: access,
            after: access.nullable(),
            changed: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.members.map((member) => member.userId)).size === value.members.length &&
      value.changedCount === value.members.filter((member) => member.changed).length,
  );
export type OrganizationBatchPreview = z.infer<typeof organizationBatchPreviewSchema>;
export function confirmsOrganizationBatchPreview(
  value: unknown,
  organizationId: string,
  input: z.infer<typeof organizationBatchPreviewInput>,
) {
  const parsed = organizationBatchPreviewSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.organizationId !== organizationId ||
    parsed.data.expectedUpdatedAt !== input.expectedUpdatedAt ||
    parsed.data.members.length !== input.userIds.length
  )
    return null;
  if (
    parsed.data.members.some((member) => {
      if (!input.userIds.includes(member.userId)) return true;
      const expected =
        input.change.action === "remove"
          ? null
          : {
              role: input.change.action === "role" ? input.change.role : member.before.role,
              managesServers:
                input.change.action === "server_access"
                  ? input.change.enabled
                  : member.before.managesServers,
            };
      const effective =
        expected &&
        (expected.role === "admin" ||
          (["member", "developer"].includes(expected.role) && expected.managesServers));
      return expected === null
        ? member.after !== null || !member.changed
        : !member.after ||
            member.after.role !== expected.role ||
            member.after.managesServers !== expected.managesServers ||
            member.after.effectiveServerAccess !== effective ||
            member.changed !==
              (expected.role !== member.before.role ||
                expected.managesServers !== member.before.managesServers);
    })
  )
    return null;
  return parsed.data;
}
export function confirmsOrganizationBatchCommand(
  value: unknown,
  organization: z.infer<typeof editableOrganizationSchema>,
  preview: OrganizationBatchPreview,
) {
  const parsed = z
    .object({
      organization: editableOrganizationSchema,
      changedUserIds: ids,
      previewRevision: z.literal(preview.previewRevision),
    })
    .strict()
    .safeParse(value);
  const expected = preview.members
    .filter((member) => member.changed)
    .map((member) => member.userId);
  if (
    !parsed.success ||
    parsed.data.organization.id !== organization.id ||
    parsed.data.organization.ownerId !== organization.ownerId ||
    parsed.data.organization.slug !== organization.slug ||
    Date.parse(parsed.data.organization.updatedAt) <= Date.parse(organization.updatedAt) ||
    parsed.data.changedUserIds.length !== expected.length ||
    parsed.data.changedUserIds.some((id) => !expected.includes(id))
  )
    return null;
  return parsed.data.organization;
}
