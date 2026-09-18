import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "../client";
import { verificationRequests, users, organizations, servers } from "../schema";
import { generateId } from "@nexus/security";

const VALID_TARGET_TYPES = ["user", "developer", "organization", "server"] as const;
export type VerificationTargetType = (typeof VALID_TARGET_TYPES)[number];

export class VerificationRepository {
  async createRequest(input: {
    requesterId: string;
    targetType: VerificationTargetType;
    targetId: string;
    proofUrl?: string;
    notes?: string;
  }) {
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

    const rows = await db.insert(verificationRequests).values(values).returning();
    return rows[0];
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

  async findPendingById(id: string) {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(and(eq(verificationRequests.id, id), eq(verificationRequests.status, "pending")))
      .limit(1);
    return rows[0] || null;
  }

  async listAll() {
    return db
      .select()
      .from(verificationRequests)
      .orderBy(desc(verificationRequests.createdAt))
      .limit(100);
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
  async resolveRequest(input: {
    id: string;
    reviewerId: string;
    decision: "approved" | "rejected";
    reviewNotes?: string;
  }) {
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
          await tx.update(users).set({ isVerified: true }).where(eq(users.id, request.targetId));
        } else if (request.targetType === "organization") {
          await tx
            .update(organizations)
            .set({ isVerified: true })
            .where(eq(organizations.id, request.targetId));
        } else if (request.targetType === "server") {
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
            throw new Error("Server claim target is already owned by another user");
          }
        }
      }

      return request;
    });
  }
}

export const verificationRepository = new VerificationRepository();
