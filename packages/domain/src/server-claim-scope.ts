/** A proof must explicitly record its ownership scope, including personal servers. */
export function serverClaimMatchesOwnershipScope(
  proof: Readonly<{ claimScopeRecorded: boolean; claimOrganizationId: string | null }>,
  server: Readonly<{ organizationId: string | null }>,
): boolean {
  return proof.claimScopeRecorded === true && proof.claimOrganizationId === server.organizationId;
}
