import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  AppError,
  ConflictError,
  NotFoundError,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  serverClaimChallenges,
  servers,
  verificationRequests,
} from "../schema";

const CHALLENGE_LIFETIME_MS = 10 * 60_000;
const TOKEN_PATTERN = /^NXCLAIM-[A-F0-9]{24}$/u;

const invalidChallenge = () =>
  new AppError(
    "Invalid or expired server control challenge",
    400,
    "INVALID_SERVER_CONTROL_CHALLENGE",
  );

export function digestServerClaimToken(token: string): string {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    throw invalidChallenge();
  }
  return createHash("sha256")
    .update(`nexus:server-claim:v1\0${token}`)
    .digest("hex");
}

function generateServerClaimToken(): string {
  return `NXCLAIM-${randomBytes(12).toString("hex").toUpperCase()}`;
}

export class ServerClaimChallengeRepository {
  async issue(input: {
    serverId: string;
    requesterId: string;
    auditId: string;
  }): Promise<{
    id: string;
    token: string;
    expiresAt: Date;
    server: { id: string; name: string; ipAddress: string; port: number };
  }> {
    const token = generateServerClaimToken();
    const tokenDigest = digestServerClaimToken(token);

    return db.transaction(async (tx) => {
      const [server] = await tx
        .select()
        .from(servers)
        .where(eq(servers.id, input.serverId))
        .for("update")
        .limit(1);

      if (!server) throw new NotFoundError("Server", input.serverId);
      if (server.ownerId && server.ownerId !== input.requesterId) {
        throw new ConflictError("This server is already claimed");
      }
      if (server.isVerified) {
        throw new ConflictError("This server is already verified");
      }

      const [pendingVerification] = await tx
        .select({ id: verificationRequests.id })
        .from(verificationRequests)
        .where(
          and(
            eq(verificationRequests.targetType, "server"),
            eq(verificationRequests.targetId, input.serverId),
            eq(verificationRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (pendingVerification) {
        throw new ConflictError(
          "A server ownership request is already pending",
        );
      }

      const [clock] = await tx.execute(
        sql`select clock_timestamp()::text as now`,
      );
      const createdAt = new Date(String(clock.now));
      const expiresAt = new Date(
        createdAt.getTime() + CHALLENGE_LIFETIME_MS,
      );

      await tx
        .update(serverClaimChallenges)
        .set({ revokedAt: createdAt })
        .where(
          and(
            eq(serverClaimChallenges.serverId, input.serverId),
            eq(serverClaimChallenges.requesterId, input.requesterId),
            isNull(serverClaimChallenges.consumedAt),
            isNull(serverClaimChallenges.revokedAt),
          ),
        );

      const id = `scc_${randomUUID()}`;
      await tx.insert(serverClaimChallenges).values({
        id,
        serverId: input.serverId,
        requesterId: input.requesterId,
        tokenDigest,
        proofVersion: 1,
        endpointRevision: server.endpointRevision,
        createdAt,
        expiresAt,
      });

      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.requesterId,
        actorType: "user",
        action: "server.claim_challenge_issued",
        targetId: input.serverId,
        targetType: "server",
        details: {
          challengeId: id,
          proofVersion: 1,
          expiresAt: expiresAt.toISOString(),
        },
        createdAt,
      });

      return Object.freeze({
        id, token, expiresAt,
        // The server returned to the caller must come from the same locked
        // row as the challenge, not an earlier service-layer read.
        server: Object.freeze({
          id: server.id,
          name: server.name,
          ipAddress: server.ipAddress,
          port: server.port,
        }),
      });
    });
  }

  async assertLive(input: {
    id: string;
    serverId: string;
    requesterId: string;
    token: string;
  }): Promise<void> {
    const tokenDigest = digestServerClaimToken(input.token);
    const [challenge] = await db
      .select({ id: serverClaimChallenges.id })
      .from(serverClaimChallenges)
      .where(
        and(
          eq(serverClaimChallenges.id, input.id),
          eq(serverClaimChallenges.serverId, input.serverId),
          eq(serverClaimChallenges.requesterId, input.requesterId),
          eq(serverClaimChallenges.tokenDigest, tokenDigest),
          isNull(serverClaimChallenges.consumedAt),
          isNull(serverClaimChallenges.revokedAt),
          gt(
            serverClaimChallenges.expiresAt,
            sql`clock_timestamp()`,
          ),
        ),
      )
      .limit(1);

    if (!challenge) throw invalidChallenge();
  }

  async consumeVerifiedProof(input: {
    id: string;
    serverId: string;
    requesterId: string;
    token: string;
    sourceFetchedAt: Date;
    expectedEndpoint: { ipAddress: string; port: number };
    verificationRequestId: string;
    auditId: string;
  }) {
    const tokenDigest = digestServerClaimToken(input.token);

    return db.transaction(async (tx) => {
      const [server] = await tx
        .select()
        .from(servers)
        .where(eq(servers.id, input.serverId))
        .for("update")
        .limit(1);
      if (!server) throw new NotFoundError("Server", input.serverId);
      if (server.ownerId && server.ownerId !== input.requesterId) {
        throw new ConflictError("This server is already claimed");
      }
      if (server.isVerified) {
        throw new ConflictError("This server is already verified");
      }

      const [challenge] = await tx
        .select()
        .from(serverClaimChallenges)
        .where(
          and(
            eq(serverClaimChallenges.id, input.id),
            eq(serverClaimChallenges.serverId, input.serverId),
            eq(serverClaimChallenges.requesterId, input.requesterId),
            eq(serverClaimChallenges.tokenDigest, tokenDigest),
          ),
        )
        .for("update")
        .limit(1);

      if (
        !challenge ||
        challenge.consumedAt ||
        challenge.revokedAt
      ) {
        throw invalidChallenge();
      }

      // The lock serializes proof verification with concurrent endpoint edits.
      // Reject a changed revision even if IP/port were changed and reverted.
      if (
        challenge.endpointRevision == null ||
        challenge.endpointRevision !== server.endpointRevision ||
        server.ipAddress !== input.expectedEndpoint.ipAddress ||
        server.port !== input.expectedEndpoint.port
      ) {
        throw new ConflictError(
          "Server endpoint changed; issue a new MTA control challenge",
        );
      }

      const [clock] = await tx.execute(
        sql`select clock_timestamp()::text as now`,
      );
      const consumedAt = new Date(String(clock.now));
      if (challenge.expiresAt <= consumedAt) {
        throw invalidChallenge();
      }
      // A bogus future timestamp could otherwise satisfy the issued-after
      // challenge constraint and persist a forged proof date.
      if (
        !Number.isFinite(input.sourceFetchedAt.getTime()) ||
        input.sourceFetchedAt.getTime() > consumedAt.getTime() + 30_000
      ) {
        throw new AppError(
          "MTA directory observation timestamp is invalid or in the future.",
          503,
          "MTA_DIRECTORY_TIMESTAMP_INVALID",
        );
      }
      if (input.sourceFetchedAt < challenge.createdAt) {
        throw new AppError(
          "The MTA directory snapshot predates this server control challenge.",
          409,
          "SERVER_CONTROL_SNAPSHOT_TOO_OLD",
        );
      }

      const [pendingVerification] = await tx
        .select({ id: verificationRequests.id })
        .from(verificationRequests)
        .where(
          and(
            eq(verificationRequests.targetType, "server"),
            eq(verificationRequests.targetId, input.serverId),
            eq(verificationRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (pendingVerification) {
        throw new ConflictError(
          "A server ownership request is already pending",
        );
      }

      const consumed = await tx
        .update(serverClaimChallenges)
        .set({
          consumedAt,
          sourceFetchedAt: input.sourceFetchedAt,
          verificationRequestId: input.verificationRequestId,
        })
        .where(
          and(
            eq(serverClaimChallenges.id, challenge.id),
            isNull(serverClaimChallenges.consumedAt),
            isNull(serverClaimChallenges.revokedAt),
            gt(
              serverClaimChallenges.expiresAt,
              sql`clock_timestamp()`,
            ),
          ),
        )
        .returning({ id: serverClaimChallenges.id });
      if (consumed.length !== 1) throw invalidChallenge();

      const notes =
        "Automated MTA master-list control challenge verified. " +
        `Challenge ${challenge.id}; source fetched at ${input.sourceFetchedAt.toISOString()}; proof version 1.`;

      const [verificationRequest] = await tx
        .insert(verificationRequests)
        .values({
          id: input.verificationRequestId,
          requesterId: input.requesterId,
          targetType: "server",
          targetId: input.serverId,
          status: "pending",
          notes,
          createdAt: consumedAt,
        })
        .returning();

      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.requesterId,
        actorType: "user",
        action: "verification.requested",
        targetId: input.verificationRequestId,
        targetType: "verification",
        details: {
          targetType: "server",
          targetId: input.serverId,
          proofMethod: "mta_master_name_challenge",
          proofVersion: 1,
          challengeId: challenge.id,
          sourceFetchedAt: input.sourceFetchedAt.toISOString(),
        },
        createdAt: consumedAt,
      });

      return Object.freeze({
        verificationRequest,
        challengeId: challenge.id,
        verifiedAt: consumedAt,
      });
    });
  }
}

export const serverClaimChallengeRepository =
  new ServerClaimChallengeRepository();

export const serverClaimChallengePolicy = Object.freeze({
  lifetimeMs: CHALLENGE_LIFETIME_MS,
  tokenPattern: TOKEN_PATTERN.source,
});
