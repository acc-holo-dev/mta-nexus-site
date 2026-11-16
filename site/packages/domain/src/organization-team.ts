/** Team administration never creates ownership grants or edits unrelated permission flags. */
export const organizationTeamRoles = ["admin", "developer", "member"] as const;
export type OrganizationTeamRole = (typeof organizationTeamRoles)[number];
export type OrganizationMemberBatchAction =
  | { action: "role"; role: OrganizationTeamRole }
  | { action: "server_access"; enabled: boolean }
  | { action: "remove" };
export function canManageOrganization(role: string) {
  return role === "owner" || role === "admin";
}
export function canChangeOrganizationMember(
  actorRole: string,
  targetRole: string,
  requestedRole: string | null,
  isSelf: boolean,
  isOwner: boolean,
) {
  if (isOwner || targetRole === "owner") return false;
  if (actorRole === "owner")
    return requestedRole === null || organizationTeamRoles.some((r) => r === requestedRole);
  return (
    actorRole === "admin" &&
    !isSelf &&
    (targetRole === "member" || targetRole === "developer") &&
    (requestedRole === null || requestedRole === "member" || requestedRole === "developer")
  );
}
export function withServerManagementPermission(permissions: readonly string[], enabled: boolean) {
  const retained = permissions.filter((value) => value !== "manage_servers");
  return enabled ? [...retained, "manage_servers"] : retained;
}
