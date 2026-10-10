import { and, asc, count, eq, desc, getTableColumns, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../client";
import { enqueueWebPushOutboxForNotification } from "./web-push-outbox";
import {
  auditEvents,
  notifications,
  verificationRequests,
  users,
  organizations,
  servers,
  serverClaimChallenges,
  developerProfiles,
} from "../schema";
import { generateId } from "@nexus/security";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  serverClaimMatchesOwnershipScope,
} from "@nexus/domain";
import type { AuditEvent } from "@nexus/domain";

import { assertOrganizationServerClaimAuthority } from "./server-claim-authority";
import { verificationTargetAuthority } from "./verification-authority";

const VALID_TARGET_TYPES = ["user", "developer", "organization", "server"] as const;
export type VerificationTargetType = (typeof VALID_TARGET_TYPES)[number];

export class VerificationRepository {
  async createRequest(
    input: {
      requesterId: string;
      targetType: VerificationTargetType;
      targetId: string;
      proofUrl?: string;
      notes?: string;
    },
    audit?: Omit<AuditEvent, "createdAt" | "targetId" | "targetType">,
  ) {
    if (input.targetType === "server") {
      throw new AppError(
        "Server ownership verification requires a verified MTA control challenge.",
        422,
        "SERVER_CONTROL_CHALLENGE_REQUIRED",
      );
    }

    if (input.targetType === "developer" && !input.proofUrl?.trim()) {
      throw new AppError("Experience evidence required", 422, "VALIDATION_ERROR");
    }

    const values = {
      id: generateId("ver"),
      requesterId: input.requesterId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: "pending",
      proofUrl: input.proofUrl,
      notes: input.notes,
      createdAt: new Date(),
    };

    return db.transaction(async (tx) => {
      // Serialize applications for the same target, including applications by different organization managers.
      const lockKey = `verification:${input.targetType}:${input.targetId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const experienceRevision = await verificationTargetAuthority(
        tx,
        input.requesterId,
        input.targetType,
        input.targetId,
        true,
      );
      const [pending] = await tx
        .select({ id: verificationRequests.id })
        .from(verificationRequests)
        .where(
          and(
            eq(verificationRequests.targetType, input.targetType),
            eq(verificationRequests.targetId, input.targetId),
            eq(verificationRequests.status, "pending"),
          ),
        )
        .limit(1);
      if (pending) throw new ConflictError("A verification request is already pending");

      const rows = await tx.insert(verificationRequests).values(values).returning();
      const request = rows[0];
      if (!request) {
        throw new Error("Verification request insert did not return a row");
      }

      {
        const entry = audit ?? {
          id: generateId("aud"),
          actorId: input.requesterId,
          actorType: "user" as const,
          action: "verification.requested",
        };
        await tx.insert(auditEvents).values({
          ...entry,
          details: {
            ...entry.details,
            ...(experienceRevision ? { developerProfileRevision: experienceRevision } : {}),
          },
          targetId: request.id,
          targetType: "verification",
          createdAt: values.createdAt,
        });
      }

      return request;
    });
  }

  async findPendingForTarget(
    requesterId: string,
    targetType: VerificationTargetType,
    targetId: string,
  ) {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.requesterId, requesterId),
          eq(verificationRequests.targetType, targetType),
          eq(verificationRequests.targetId, targetId),
          eq(verificationRequests.status, "pending"),
        ),
      )
      .limit(1);
    return rows[0] || null;
  }

  async findPendingForAnyRequester(targetType: VerificationTargetType, targetId: string) {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.targetType, targetType),
          eq(verificationRequests.targetId, targetId),
          eq(verificationRequests.status, "pending"),
        ),
      )
      .limit(1);
    return rows[0] || null;
  }

  async findPendingById(id: string) {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(and(eq(verificationRequests.id, id), eq(verificationRequests.status, "pending")))
      .limit(1);
    return rows[0] || null;
  }

  async findById(id: string) {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async countPending(): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(verificationRequests)
      .where(eq(verificationRequests.status, "pending"));
    return row?.total ?? 0;
  }

  async listPage(view: "pending" | "history", page: number, pageSize = 30) {
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 99_999 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      throw new RangeError("Invalid verification page");
    }
    const filter =
      view === "pending"
        ? eq(verificationRequests.status, "pending")
        : inArray(verificationRequests.status, ["approved", "rejected"]);
    const ordering =
      view === "pending"
        ? [asc(verificationRequests.createdAt), asc(verificationRequests.id)]
        : [desc(verificationRequests.resolvedAt), desc(verificationRequests.id)];
    const rows = await db
      .select({
        ...getTableColumns(verificationRequests),
        targetUsername: users.username,
        organizationSlug: organizations.slug,
        currentSpecialties: developerProfiles.specialties,
        currentGithubUrl: developerProfiles.githubUrl,
      })
      .from(verificationRequests)
      .leftJoin(
        users,
        and(
          eq(users.id, verificationRequests.targetId),
          inArray(verificationRequests.targetType, ["user", "developer"]),
        ),
      )
      .leftJoin(
        organizations,
        and(
          eq(organizations.id, verificationRequests.targetId),
          eq(verificationRequests.targetType, "organization"),
        ),
      )
      .leftJoin(
        developerProfiles,
        and(
          eq(developerProfiles.userId, users.id),
          eq(verificationRequests.targetType, "developer"),
        ),
      )
      .where(filter)
      .orderBy(...ordering)
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    return { requests: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
  }

  async listByRequester(requesterId: string) {
    return db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.requesterId, requesterId))
      .orderBy(desc(verificationRequests.createdAt))
      .limit(100);
  }

  /**
   * Atomically resolve a pending request and apply verification to its target.
   * The conditional update prevents two moderators from resolving the same request.
   */
  async resolveRequest(
    input: {
      id: string;
      reviewerId: string;
      decision: "approved" | "rejected";
      reviewNotes?: string;
    },
    audit?: Omit<AuditEvent, "createdAt">,
  ) {
    return db.transaction(async (tx) => {
      const [liveReviewer] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.reviewerId))
        .limit(1);
      if (!liveReviewer || !["admin", "moderator"].includes(liveReviewer.role))
        throw new ForbiddenError();
      const rows = await tx
        .update(verificationRequests)
        .set({
          status: input.decision,
          reviewerId: input.reviewerId,
          reviewNotes: input.reviewNotes,
          resolvedAt: new Date(),
        })
        .where(
          and(eq(verificationRequests.id, input.id), eq(verificationRequests.status, "pending")),
        )
        .returning();

      const request = rows[0];
      if (!request) return null;

      if (input.decision === "approved") {
        if (request.requesterId === input.reviewerId)
          throw new AppError("Independent review required", 403, "VERIFICATION_SELF_REVIEW");
        if (request.targetType === "user" || request.targetType === "developer") {
          // Lock both identities in stable order for cross-reviewing moderators.
          await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, [input.reviewerId, request.targetId]))
            .orderBy(asc(users.id))
            .for("update");
        }
        if (request.targetType !== "server") {
          const currentRevision = await verificationTargetAuthority(
            tx,
            request.requesterId,
            request.targetType,
            request.targetId,
            false,
          );
          if (request.targetType === "developer") {
            const [submission] = await tx
              .select({ details: auditEvents.details })
              .from(auditEvents)
              .where(
                and(
                  eq(auditEvents.targetId, request.id),
                  eq(auditEvents.targetType, "verification"),
                  eq(auditEvents.action, "verification.requested"),
                ),
              )
              .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
              .limit(1);
            if (
              !currentRevision ||
              submission?.details?.developerProfileRevision !== currentRevision
            )
              throw new AppError(
                "Developer profile changed since submission",
                409,
                "VERIFICATION_PROFILE_CHANGED",
              );
            await tx
              .update(developerProfiles)
              .set({ verifiedDeveloper: true })
              .where(eq(developerProfiles.userId, request.targetId));
          }
        }
        if (request.targetType === "user" || request.targetType === "developer") {
          const verifiedUsers = await tx
            .update(users)
            .set({ isVerified: true })
            .where(eq(users.id, request.targetId))
            .returning({ id: users.id });
          if (!verifiedUsers[0]) {
            throw new ConflictError("Verification target no longer exists");
          }
        } else if (request.targetType === "organization") {
          const verifiedOrganizations = await tx
            .update(organizations)
            .set({ isVerified: true })
            .where(eq(organizations.id, request.targetId))
            .returning({ id: organizations.id });
          if (!verifiedOrganizations[0]) {
            throw new ConflictError("Verification target no longer exists");
          }
        } else if (request.targetType === "server") {
          const [server] = await tx
            .select({
              ownerId: servers.ownerId,
              organizationId: servers.organizationId,
              endpointRevision: servers.endpointRevision,
              isVerified: servers.isVerified,
            })
            .from(servers)
            .where(eq(servers.id, request.targetId))
            .for("update")
            .limit(1);
          if (
            !server ||
            server.isVerified ||
            (!server.organizationId && server.ownerId && server.ownerId !== request.requesterId)
          ) {
            throw new ConflictError("Server is missing, verified or already owned");
          }
          const [proof] = await tx
            .select({
              id: serverClaimChallenges.id,
              endpointRevision: serverClaimChallenges.endpointRevision,
              claimScopeRecorded: serverClaimChallenges.claimScopeRecorded,
              claimOrganizationId: serverClaimChallenges.claimOrganizationId,
            })
            .from(serverClaimChallenges)
            .where(
              and(
                eq(serverClaimChallenges.verificationRequestId, request.id),
                eq(serverClaimChallenges.serverId, request.targetId),
                eq(serverClaimChallenges.requesterId, request.requesterId),
                eq(serverClaimChallenges.proofVersion, 1),
                isNotNull(serverClaimChallenges.consumedAt),
                isNotNull(serverClaimChallenges.sourceFetchedAt),
              ),
            )
            .limit(1);

          if (!proof || proof.endpointRevision == null) {
            throw new ConflictError(
              "Current-endpoint MTA control proof is required before approval",
            );
          }

          if (!serverClaimMatchesOwnershipScope(proof, server)) {
            throw new AppError(
              "Server ownership scope changed; new control proof required",
              409,
              "SERVER_CLAIM_SCOPE_CHANGED",
            );
          }
          if (server.endpointRevision !== proof.endpointRevision) {
            throw new ConflictError("Server endpoint changed; new control proof required");
          }
          if (server.organizationId) {
            await assertOrganizationServerClaimAuthority(
              tx,
              server.organizationId,
              request.requesterId,
              409,
            );
          }
          // Organization verification never turns its manager into a personal owner.
          const claimed = await tx
            .update(servers)
            .set({
              ownerId: server.organizationId ? null : request.requesterId,
              isVerified: true,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(servers.id, request.targetId),
                eq(servers.endpointRevision, proof.endpointRevision),
                eq(servers.isVerified, false),
              ),
            )
            .returning({ id: servers.id });

          if (!claimed[0]) {
            throw new ConflictError(
              "Server endpoint changed or is already owned; new MTA control proof required",
            );
          }
        }
      }

      const [reviewer] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.reviewerId))
        .for("share")
        .limit(1);
      if (!reviewer || !["admin", "moderator"].includes(reviewer.role)) throw new ForbiddenError();

      if (request.targetType === "server") {
        await tx.insert(auditEvents).values({
          id: `aud_server_verification_${request.id}`,
          actorId: input.reviewerId,
          actorType: "admin",
          action:
            input.decision === "approved"
              ? "server.verification_approved"
              : "server.verification_rejected",
          targetId: request.targetId,
          targetType: "server",
          createdAt: new Date(),
        });
      }
        await tx.insert(auditEvents).values({
          ...(audit ?? {
            id: generateId("aud"),
            actorId: input.reviewerId,
            actorType: "admin" as const,
            action: `verification.${input.decision}`,
            targetType: "verification",
            targetId: request.id,
            details: { notes: input.reviewNotes ?? "" },
          }),
          createdAt: new Date(),
        });

      const decisionLabel = input.decision === "approved" ? "approved" : "rejected";
      const [resolutionNotification] = await tx
        .insert(notifications)
        .values({
          id: `ntf_verification_resolution_${request.id}`,
          recipientId: request.requesterId,
          title: input.decision === "approved" ? "Verification approved" : "Verification rejected",
          message: `${request.targetType} verification for ${request.targetId} was ${decisionLabel}.`,
          link: `/workspace/verification?view=history`,
          type: "security",
          category: "security",
          isRead: false,
          createdAt: new Date(),
        })
        .returning({
          id: notifications.id,
          recipientId: notifications.recipientId,
        });
      if (!resolutionNotification) {
        throw new Error("Verification notification insert failed");
      }
      let pushQueued = 0;
      let pushQueueDegraded = 0;
      try {
        const queued = await tx.transaction((pushTx) =>
          enqueueWebPushOutboxForNotification(
            pushTx,
            resolutionNotification.id,
            resolutionNotification.recipientId,
          ),
        );
        pushQueued = queued.queued;
        if (queued.reason === "saturated") {
          pushQueueDegraded = 1;
        }
      } catch {
        // Resolution/audit/inbox are authoritative. Push queue failure is
        // isolated to this savepoint.
        pushQueueDegraded = 1;
      }
      if (pushQueueDegraded > 0) {
        console.warn(
          JSON.stringify({
            event: "notification.push_outbox_degraded",
            producer: "verification_resolution",
            notifications: 1,
            pushQueued,
            pushQueueDegraded,
          }),
        );
      }

      return request;
    });
  }
}

export const verificationRepository = new VerificationRepository();
