/**
 * Shared rule for delegated MTA server management. Organization ownership is
 * checked separately against the current organization row, not a membership
 * supplied by the browser.
 */
export type ServerManagementMembership = Readonly<{
  role: string;
  permissions: readonly string[] | null | undefined;
}>;

export function grantsServerManagement(
  membership: ServerManagementMembership | null | undefined,
): boolean {
  if (!membership) return false;
  return membership.role === "admin" ||
    (["member", "developer"].includes(membership.role) && Array.isArray(membership.permissions) &&
      membership.permissions.includes("manage_servers"));
}
