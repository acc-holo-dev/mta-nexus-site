import {  serverClaimChallengeRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  type Server,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
import {
  matchesMtaEndpoint,
  mtaMasterDirectoryService,
} from "./mta-master-directory-service";
import { serverService } from "./server-service";
import { dispatchNotificationsBestEffort } from "./notification-dispatch-service";

async function assertRequesterCanChallenge(
  server: Server,
  requester: User,
): Promise<void> {
  if (server.isVerified) {
    throw new ConflictError("This server is already verified");
  }

  if (server.ownerId && server.ownerId !== requester.id) {
    throw new ConflictError("This server is already claimed");
  }

  if (
    server.organizationId &&
    !(await serverService.canManageServer(server, requester))
  ) {
    throw new ForbiddenError(
      "You do not manage the organization linked to this server",
    );
  }
}

export async function notifyModeratorsOfServerClaim(
  serverName: string,
): Promise<void> {
  try {
    const moderatorIds = await userRepository.listModeratorIds();
    await dispatchNotificationsBestEffort(
      moderatorIds.map((moderatorId) => ({
        recipientId: moderatorId,
        title: "Server ownership proof requires review",
        message: "MTA control proof verified for " + serverName,
        link: "/admin",
        type: "security" as const,
        category: "security" as const,
      })),
    );
  } catch {
    // The durable verification request is the source of truth. Moderator
    // inbox/push delivery is secondary and must not affect proof success.
  }
}

export const serverClaimService = {
  async issueChallenge(serverId: string, requester: User) {
    const server = await serverRepository.findById(serverId);
    if (!server) throw new NotFoundError("Server", serverId);
    await assertRequesterCanChallenge(server, requester);

    const challenge = await serverClaimChallengeRepository.issue({
      serverId,
      requesterId: requester.id,
      auditId: generateId("aud"),
    });

    return Object.freeze({
      challengeId: challenge.id,
      token: challenge.token,
      expiresAt: challenge.expiresAt.toISOString(),
      server: Object.freeze({
        id: server.id,
        name: server.name,
        ipAddress: server.ipAddress,
        port: server.port,
      }),
    });
  },

  async verifyChallenge(
    input: {
      serverId: string;
      challengeId: string;
      token: string;
    },
    requester: User,
  ) {
    const server = await serverRepository.findById(input.serverId);
    if (!server) throw new NotFoundError("Server", input.serverId);
    await assertRequesterCanChallenge(server, requester);

    await serverClaimChallengeRepository.assertLive({
      id: input.challengeId,
      serverId: server.id,
      requesterId: requester.id,
      token: input.token,
    });

    const directory = await mtaMasterDirectoryService.getDirectory();
    if (directory.isStale) {
      throw new AppError(
        "The official MTA directory snapshot is stale. Try proof verification again later.",
        503,
        "MTA_DIRECTORY_STALE",
      );
    }

    const observed = directory.servers.find((candidate) =>
      matchesMtaEndpoint(server, candidate),
    );
    if (!observed || observed.responding === false) {
      throw new AppError(
        "The server must be visible and responding in the official MTA directory before control can be verified.",
        409,
        "SERVER_CONTROL_PROOF_NOT_LIVE",
      );
    }

    if (
      typeof observed.name !== "string" ||
      !observed.name.includes(input.token)
    ) {
      throw new AppError(
        "The control token is not visible in the current MTA server name.",
        422,
        "SERVER_CONTROL_TOKEN_NOT_VISIBLE",
      );
    }

    const sourceFetchedAt = new Date(directory.fetchedAt);
    if (Number.isNaN(sourceFetchedAt.getTime())) {
      throw new AppError(
        "The official MTA directory returned an invalid observation timestamp.",
        503,
        "MTA_DIRECTORY_TIMESTAMP_INVALID",
      );
    }

    const completed =
      await serverClaimChallengeRepository.consumeVerifiedProof({
        id: input.challengeId,
        serverId: server.id,
        requesterId: requester.id,
        token: input.token,
        sourceFetchedAt,
        verificationRequestId: generateId("ver"),
        auditId: generateId("aud"),
      });

    return Object.freeze({
      success: true as const,
      moderatorNotification: Object.freeze({
        serverName: server.name,
      }),
      verificationRequest: completed.verificationRequest,
      proof: Object.freeze({
        method: "mta_master_name_challenge" as const,
        challengeId: completed.challengeId,
        sourceFetchedAt: sourceFetchedAt.toISOString(),
        verifiedAt: completed.verifiedAt.toISOString(),
      }),
    });
  },
};
