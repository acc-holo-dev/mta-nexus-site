import { isValidMtaAddress, normalizeMtaAddress } from "./mta-endpoint";

export type ServerEndpointAuditRow = Readonly<{
  id: string;
  ipAddress: string;
  port: number;
  ownerId?: string | null;
  organizationId?: string | null;
  isVerified?: boolean;
}>;

export type ServerEndpointAuditDetail = ServerEndpointAuditRow & Readonly<{
  canonicalAddress: string;
}>;

/**
 * Read-only preparation for a future canonical endpoint uniqueness migration.
 * Call add() once per server, in any order. No records are modified or merged.
 */
export class ServerEndpointAuditCollector {
  private scanned = 0;
  private mixedOwnershipRows = 0;
  private unclaimedRows = 0;
  private readonly invalidRows: ServerEndpointAuditDetail[] = [];
  private readonly nonCanonicalRows: ServerEndpointAuditDetail[] = [];
  private readonly groups = new Map<string, ServerEndpointAuditDetail[]>();

  add(row: ServerEndpointAuditRow): void {
    this.scanned += 1;
    const canonicalAddress = normalizeMtaAddress(row.ipAddress);
    const entry = { ...row, canonicalAddress };
    if (row.ownerId && row.organizationId) this.mixedOwnershipRows += 1;
    if (!row.ownerId && !row.organizationId) this.unclaimedRows += 1;
    if (
      !isValidMtaAddress(canonicalAddress) ||
      !Number.isInteger(row.port) ||
      row.port < 1 ||
      row.port > 65535
    ) {
      this.invalidRows.push(entry);
      return;
    }
    if (row.ipAddress !== canonicalAddress) this.nonCanonicalRows.push(entry);
    const key = JSON.stringify([canonicalAddress, row.port]);
    const group = this.groups.get(key);
    if (group) group.push(entry);
    else this.groups.set(key, [entry]);
  }

  result() {
    const scope = (row: ServerEndpointAuditRow): string =>
      row.organizationId ? `organization:${row.organizationId}` :
      row.ownerId ? `user:${row.ownerId}` : "unclaimed";
    const collisions = [...this.groups.values()]
      .filter((group) => group.length > 1)
      .sort((a, b) =>
        a[0]!.canonicalAddress.localeCompare(b[0]!.canonicalAddress) ||
        a[0]!.port - b[0]!.port,
      );
    const collisionDetails = collisions.map((group) => {
      const ownerScopes = [...new Set(group.map(scope))].sort();
      return {
        canonicalAddress: group[0]!.canonicalAddress,
        port: group[0]!.port,
        serverIds: group.map((item) => item.id).sort(),
        ownerScopes,
        verifiedServerIds: group.filter((item) => item.isVerified).map((item) => item.id).sort(),
        ownershipConflict: ownerScopes.length > 1 ||
          group.some((item) => item.ownerId && item.organizationId),
      };
    });
    return {
      summary: {
        scanned: this.scanned,
        invalidRows: this.invalidRows.length,
        nonCanonicalRows: this.nonCanonicalRows.length,
        mixedOwnershipRows: this.mixedOwnershipRows,
        unclaimedRows: this.unclaimedRows,
        collisionGroups: collisions.length,
        collidingRows: collisions.reduce((total, group) => total + group.length, 0),
        collisionGroupsWithOwnershipConflict: collisionDetails.filter(
          (group) => group.ownershipConflict,
        ).length,
        collisionGroupsWithVerifiedServers: collisionDetails.filter(
          (group) => group.verifiedServerIds.length > 0,
        ).length,
      },
      details: {
        invalidRows: [...this.invalidRows],
        nonCanonicalRows: [...this.nonCanonicalRows],
        collisions: collisionDetails,
      },
    };
  }
}
