import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { serverClaimMatchesOwnershipScope, type User } from "@nexus/domain";
import { db } from "../client";
import { serverClaimChallenges, servers, verificationRequests } from "../schema";
import { managedServerScope } from "./server-management-scope";

export type ManagedServerClaimStatus = Readonly<{
  isVerified: boolean;
  request: null | Readonly<{
    status: "pending" | "approved" | "rejected";
    createdAt: Date;
    resolvedAt: Date | null;
    isRequester: boolean;
    proofMatchesServer: boolean;
  }>;
}>;

export async function readManagedServerClaimStatus(
  serverId: string,
  actor: Pick<User, "id" | "role">,
): Promise<ManagedServerClaimStatus | null> {
  if (!serverId || !actor.id) throw new RangeError("Server and actor IDs are required");
  return db.transaction(
    async (tx) => {
      const [server] = await tx
        .select({
          isVerified: servers.isVerified,
          endpointRevision: servers.endpointRevision,
          organizationId: servers.organizationId,
        })
        .from(servers)
        .where(
          and(
            eq(servers.id, serverId),
            actor.role === "admin" ? undefined : managedServerScope(actor.id),
          ),
        )
        .limit(1);
      if (!server) return null;

      const [request] = await tx
        .select({
          status: verificationRequests.status,
          createdAt: verificationRequests.createdAt,
          resolvedAt: verificationRequests.resolvedAt,
          isRequester: sql<boolean>`${verificationRequests.requesterId} = ${actor.id}`,
          endpointRevision: serverClaimChallenges.endpointRevision,
          claimScopeRecorded: serverClaimChallenges.claimScopeRecorded,
          claimOrganizationId: serverClaimChallenges.claimOrganizationId,
        })
        .from(verificationRequests)
        .leftJoin(
          serverClaimChallenges,
          and(
            eq(serverClaimChallenges.verificationRequestId, verificationRequests.id),
            eq(serverClaimChallenges.serverId, serverId),
            eq(serverClaimChallenges.requesterId, verificationRequests.requesterId),
          ),
        )
        .where(
          and(
            eq(verificationRequests.targetType, "server"),
            eq(verificationRequests.targetId, serverId),
            inArray(verificationRequests.status, ["pending", "approved", "rejected"]),
          ),
        )
        .orderBy(desc(verificationRequests.createdAt), desc(verificationRequests.id))
        .limit(1);

      return {
        isVerified: server.isVerified,
        request: request
          ? {
              status: request.status as "pending" | "approved" | "rejected",
              createdAt: request.createdAt,
              resolvedAt: request.resolvedAt,
              isRequester: request.isRequester,
              proofMatchesServer:
                request.endpointRevision !== null &&
                request.endpointRevision === server.endpointRevision &&
                serverClaimMatchesOwnershipScope(
                  {
                    claimScopeRecorded: request.claimScopeRecorded === true,
                    claimOrganizationId: request.claimOrganizationId,
                  },
                  server,
                ),
            }
          : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
