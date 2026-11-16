import { z } from "zod";
import { externalWebUrlSchema } from "@nexus/validation";
import { organizationTeamRoles } from "@nexus/domain";
import { parseContentPage } from "./user-platform-contract";
const organizationFieldsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(4000),
  logoUrl: externalWebUrlSchema.or(z.literal("")),
  websiteUrl: externalWebUrlSchema.or(z.literal("")),
});
export const organizationCreateSchema = organizationFieldsSchema
  .extend({
    slug: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  })
  .strict();
export const organizationUpdateSchema = organizationFieldsSchema
  .extend({ expectedUpdatedAt: z.iso.datetime() })
  .strict();
export const memberAddSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z0-9_-]+$/u),
    role: z.enum(organizationTeamRoles),
    managesServers: z.boolean(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .strict();
export const memberUpdateSchema = memberAddSchema.omit({ username: true }).strict();
export const memberRemoveSchema = z.object({ expectedUpdatedAt: z.iso.datetime() }).strict();
export const editableOrganizationSchema = organizationFieldsSchema.extend({
  id: z.string().min(1).max(128),
  slug: z.string().min(1),
  ownerId: z.string().min(1),
  isVerified: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type EditableOrganization = z.infer<typeof editableOrganizationSchema>;
const identitySchema = z.object({
  id: z.string().min(1),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
export const organizationWorkspaceSchema = z.object({
  organization: editableOrganizationSchema,
  role: z.enum(["owner", ...organizationTeamRoles]),
  owner: identitySchema.nullable(),
  members: z
    .array(
      identitySchema.extend({
        role: z.string(),
        managesServers: z.boolean(),
        joinedAt: z.iso.datetime(),
      }),
    )
    .max(20),
  page: z.number().int().min(1).max(9999),
  hasMore: z.boolean(),
});
export type OrganizationWorkspace = z.infer<typeof organizationWorkspaceSchema>;
export function parseOrganizationPage(query: Parameters<typeof parseContentPage>[0]) {
  const { page, query: term } = parseContentPage(query);
  return { page, query: term };
}
