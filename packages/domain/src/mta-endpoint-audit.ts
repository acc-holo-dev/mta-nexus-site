import { isValidMtaAddress, normalizeMtaAddress } from "./mta-endpoint";

export type ServerEndpointAuditRow = Readonly<{
  id: string;
  ipAddress: string;
  port: number;
  ownerId?: string | null;
  organizationId?: string | null;
  isVerified?: boolean;
}>;

export type ServerEndpointAuditDetail = ServerEndpointAuditRow &
  Readonly<{
    canonicalAddress: string;
  }>;

type EndpointGroup = {
  canonicalAddress: string;
  port: number;
  count: number;
  firstOwnerScope: string;
  hasDifferentOwners: boolean;
  hasMixedOwnership: boolean;
  hasVerified: boolean;
  details: {
    serverIds: string[];
    ownerScopes: Set<string>;
    verifiedServerIds: string[];
  } | null;
};

function ownerScope(row: ServerEndpointAuditRow): string {
  return row.organizationId
    ? `organization:${row.organizationId}`
    : row.ownerId
      ? `user:${row.ownerId}`
      : "unclaimed";
}

/**
 * Streaming, read-only collision census. The default retains review details
 * for tests and explicit operator requests. In summary mode no server IDs or
 * raw addresses are retained in detail arrays. The endpoint key and first
 * ownership scope are kept to identify duplicates and cross-owner conflicts.
 */
export class ServerEndpointAuditCollector {
  private scanned = 0;
  private invalidCount = 0;
  private nonCanonicalCount = 0;
  private mixedOwnershipRows = 0;
  private unclaimedRows = 0;
  private readonly invalidRows: ServerEndpointAuditDetail[] = [];
  private readonly nonCanonicalRows: ServerEndpointAuditDetail[] = [];
  private readonly groups = new Map<string, EndpointGroup>();

  constructor(private readonly includeDetails = true) {}

  add(row: ServerEndpointAuditRow): void {
    this.scanned += 1;
    const canonicalAddress = normalizeMtaAddress(row.ipAddress);
    const mixedOwnership = Boolean(row.ownerId && row.organizationId);
    if (mixedOwnership) this.mixedOwnershipRows += 1;
    if (!row.ownerId && !row.organizationId) this.unclaimedRows += 1;
    const valid =
      isValidMtaAddress(canonicalAddress) &&
      Number.isInteger(row.port) &&
      row.port >= 1 &&
      row.port <= 65535;
    if (!valid) {
      this.invalidCount += 1;
      if (this.includeDetails) this.invalidRows.push({ ...row, canonicalAddress });
      return;
    }
    if (row.ipAddress !== canonicalAddress) {
      this.nonCanonicalCount += 1;
      if (this.includeDetails) this.nonCanonicalRows.push({ ...row, canonicalAddress });
    }

    const key = JSON.stringify([canonicalAddress, row.port]);
    const scope = ownerScope(row);
    const group = this.groups.get(key);
    if (!group) {
      this.groups.set(key, {
        canonicalAddress,
        port: row.port,
        count: 1,
        firstOwnerScope: scope,
        hasDifferentOwners: false,
        hasMixedOwnership: mixedOwnership,
        hasVerified: Boolean(row.isVerified),
        details: this.includeDetails
          ? {
              serverIds: [row.id],
              ownerScopes: new Set([scope]),
              verifiedServerIds: row.isVerified ? [row.id] : [],
            }
          : null,
      });
      return;
    }
    group.count += 1;
    if (scope !== group.firstOwnerScope) group.hasDifferentOwners = true;
    if (mixedOwnership) group.hasMixedOwnership = true;
    if (row.isVerified) group.hasVerified = true;
    if (group.details) {
      group.details.serverIds.push(row.id);
      group.details.ownerScopes.add(scope);
      if (row.isVerified) group.details.verifiedServerIds.push(row.id);
    }
  }

  result() {
    const collisions = [...this.groups.values()]
      .filter((group) => group.count > 1)
      .sort((a, b) => a.canonicalAddress.localeCompare(b.canonicalAddress) || a.port - b.port);
    return {
      summary: {
        scanned: this.scanned,
        invalidRows: this.invalidCount,
        nonCanonicalRows: this.nonCanonicalCount,
        mixedOwnershipRows: this.mixedOwnershipRows,
        unclaimedRows: this.unclaimedRows,
        collisionGroups: collisions.length,
        collidingRows: collisions.reduce((total, group) => total + group.count, 0),
        collisionGroupsWithOwnershipConflict: collisions.filter(
          (group) => group.hasDifferentOwners || group.hasMixedOwnership,
        ).length,
        collisionGroupsWithVerifiedServers: collisions.filter((group) => group.hasVerified).length,
      },
      details: {
        invalidRows: [...this.invalidRows],
        nonCanonicalRows: [...this.nonCanonicalRows],
        collisions: this.includeDetails
          ? collisions.map((group) => {
              if (!group.details) throw new Error("Endpoint audit details are unavailable");
              return {
                canonicalAddress: group.canonicalAddress,
                port: group.port,
                serverIds: [...group.details.serverIds].sort(),
                ownerScopes: [...group.details.ownerScopes].sort(),
                verifiedServerIds: [...group.details.verifiedServerIds].sort(),
                ownershipConflict: group.hasDifferentOwners || group.hasMixedOwnership,
              };
            })
          : [],
      },
    };
  }
}
