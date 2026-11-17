import {
  editableOrganizationSchema,
  type EditableOrganization,
} from "./organization-workspace-contract";
export function confirmsOrganizationMemberMutation(
  result: unknown,
  previous: Pick<EditableOrganization, "id" | "ownerId" | "slug" | "updatedAt">,
  expected: {
    userId?: string;
    username?: string;
    role?: string;
    managesServers?: boolean;
    removed?: boolean;
  },
  added = false,
) {
  if (!result || typeof result !== "object") return null;
  const value = result as Record<string, unknown>,
    organization = editableOrganizationSchema.safeParse(value.organization);
  if (
    !organization.success ||
    organization.data.id !== previous.id ||
    organization.data.ownerId !== previous.ownerId ||
    organization.data.slug !== previous.slug ||
    organization.data.updatedAt === previous.updatedAt
  )
    return null;
  const confirmed = added ? value.member : value;
  if (
    !confirmed ||
    typeof confirmed !== "object" ||
    Object.entries(expected).some(
      ([key, field]) => (confirmed as Record<string, unknown>)[key] !== field,
    )
  )
    return null;
  return organization.data;
}
