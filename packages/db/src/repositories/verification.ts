import { eq, desc } from "drizzle-orm";
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

  async findPendingById(id: string) {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, id))
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
      .orderBy(desc(verificationRequests.createdAt));
  }

  /**
   * Resolve a verification request and apply the verified flag to the target entity.
   * Verification can only be granted through this moderation workflow.
   */
  async resolveRequest(input: {
    id: string;
    reviewerId: string;
    decision: "approved" | "rejected";
    reviewNotes?: string;
  }) {
    const request = await this.findPendingById(input.id);
    if (!request) return null;
    if (request.status !== "pending") return null;

    const rows = await db
      .update(verificationRequests)
      .set({
        status: input.decision,
        reviewerId: input.reviewerId,
        reviewNotes: input.reviewNotes,
        resolvedAt: new Date(),
      })
      .where(eq(verificationRequests.id, input.id))
      .returning();

    // Apply the verified flag to the target entity upon approval
    if (input.decision === "approved") {
      if (request.targetType === "user" || request.targetType === "developer") {
        await db.update(users).set({ isVerified: true }).where(eq(users.id, request.targetId));
      } else if (request.targetType === "organization") {
        await db
          .update(organizations)
          .set({ isVerified: true })
          .where(eq(organizations.id, request.targetId));
      } else if (request.targetType === "server") {
        await db.update(servers).set({ isVerified: true }).where(eq(servers.id, request.targetId));
      }
    }

    return rows[0];
  }
}

export const verificationRepository = new VerificationRepository();
