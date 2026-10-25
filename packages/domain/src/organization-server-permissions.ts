/**
 * Shared rule for organization-scoped MTA server management from a DB-backed
 * membership. Org-row ownership checks stay separate where a caller must prove
 * the current organization owner id; membership role `owner` still grants here.
 */
export type ServerManagementMembership = Readonly<{
  role: string;
  permissions: readonly string[] | null | undefined;
}>;

export function grantsServerManagement(
  membership: ServerManagementMembership | null | undefined,
): boolean {
  if (!membership) return false;
  return membership.role === "owner" ||
    membership.role === "admin" ||
    (["member", "developer"].includes(membership.role) && Array.isArray(membership.permissions) &&
      membership.permissions.includes("manage_servers"));
}
