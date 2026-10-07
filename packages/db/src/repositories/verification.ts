import { and, asc, count, eq, desc, inArray, isNotNull, sql } from "drizzle-orm";
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
} from "../schema";
import { generateId } from "@nexus/security";
import { AppError, ConflictError } from "@nexus/domain";
import type { AuditEvent } from "@nexus/domain";

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
      const [pending] = await tx.select({ id: verificationRequests.id })
        .from(verificationRequests)
        .where(and(
          eq(verificationRequests.targetType, input.targetType),
          eq(verificationRequests.targetId, input.targetId),
          eq(verificationRequests.status, "pending"),
        ))
        .limit(1);
      if (pending) throw new ConflictError("A verification request is already pending");

      const rows = await tx
        .insert(verificationRequests)
        .values(values)
        .returning();
      const request = rows[0];
      if (!request) {
        throw new Error("Verification request insert did not return a row");
      }

      if (audit) {
        await tx.insert(auditEvents).values({
          ...audit,
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
    targetId: string
  ) {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.requesterId, requesterId),
          eq(verificationRequests.targetType, targetType),
          eq(verificationRequests.targetId, targetId),
          eq(verificationRequests.status, "pending")
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  async findPendingForAnyRequester(
    targetType: VerificationTargetType,
    targetId: string,
  ) {
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
    const [row] = await db.select({ total: count() }).from(verificationRequests)
      .where(eq(verificationRequests.status, "pending"));
    return row?.total ?? 0;
  }

  async listPage(view: "pending" | "history", page: number, pageSize = 30) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 99_999 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Invalid verification page");
    }
    const filter = view === "pending"
      ? eq(verificationRequests.status, "pending")
      : inArray(verificationRequests.status, ["approved", "rejected"]);
    const ordering = view === "pending"
      ? [asc(verificationRequests.createdAt), asc(verificationRequests.id)]
      : [desc(verificationRequests.resolvedAt), desc(verificationRequests.id)];
    const rows = await db.select().from(verificationRequests)
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
      const rows = await tx
        .update(verificationRequests)
        .set({
          status: input.decision,
          reviewerId: input.reviewerId,
          reviewNotes: input.reviewNotes,
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(verificationRequests.id, input.id),
            eq(verificationRequests.status, "pending")
          )
        )
        .returning();

      const request = rows[0];
      if (!request) return null;

      if (input.decision === "approved") {
        if (request.targetType === "user" || request.targetType === "developer") {
          const verifiedUsers = await tx
            .update(users)
            .set({ isVerified: true })
            .where(eq(users.id, request.targetId))
            .returning({ id: users.id });
          if (!verifiedUsers[0]) {
            throw new ConflictError(
              "Verification target no longer exists",
            );
          }
        } else if (request.targetType === "organization") {
          const verifiedOrganizations = await tx
            .update(organizations)
            .set({ isVerified: true })
            .where(eq(organizations.id, request.targetId))
            .returning({ id: organizations.id });
          if (!verifiedOrganizations[0]) {
            throw new ConflictError(
              "Verification target no longer exists",
            );
          }
        } else if (request.targetType === "server") {
          const [proof] = await tx
            .select({ id: serverClaimChallenges.id })
            .from(serverClaimChallenges)
            .where(
              and(
                eq(
                  serverClaimChallenges.verificationRequestId,
                  request.id,
                ),
                eq(serverClaimChallenges.serverId, request.targetId),
                eq(
                  serverClaimChallenges.requesterId,
                  request.requesterId,
                ),
                eq(serverClaimChallenges.proofVersion, 1),
                isNotNull(serverClaimChallenges.consumedAt),
                isNotNull(serverClaimChallenges.sourceFetchedAt),
              ),
            )
            .limit(1);

          if (!proof) {
            throw new ConflictError(
              "Verified MTA server control proof is required before approval",
            );
          }

          // A server claim is finalized only by moderation. The conditional
          // ownership update prevents approving a stale request after another
          // claimant has already become the owner.
          const claimed = await tx
            .update(servers)
            .set({
              ownerId: request.requesterId,
              isVerified: true,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(servers.id, request.targetId),
                sql`${servers.ownerId} IS NULL OR ${servers.ownerId} = ${request.requesterId}`
              )
            )
            .returning({ id: servers.id });

          if (!claimed[0]) {
            throw new ConflictError("Server claim target is already owned by another user");
          }
        }
      }

      if (audit) {
        await tx.insert(auditEvents).values({
          ...audit,
          createdAt: new Date(),
        });
      }

      const decisionLabel =
        input.decision === "approved" ? "approved" : "rejected";
      const [resolutionNotification] = await tx
        .insert(notifications)
        .values({
          id: `ntf_verification_resolution_${request.id}`,
          recipientId: request.requesterId,
          title:
            input.decision === "approved"
              ? "Verification approved"
              : "Verification rejected",
          message: `${request.targetType} verification for ${request.targetId} was ${decisionLabel}.`,
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
      try {
        await tx.transaction((pushTx) =>
          enqueueWebPushOutboxForNotification(
            pushTx,
            resolutionNotification.id,
            resolutionNotification.recipientId,
          ),
        );
      } catch {
        // Resolution/audit/inbox are authoritative. Push queue failure is
        // isolated to this savepoint.
      }

      return request;
    });
  }
}

export const verificationRepository = new VerificationRepository();
