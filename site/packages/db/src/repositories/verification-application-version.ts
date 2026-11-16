import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { db } from "../client";
import { auditEvents, verificationRequests } from "../schema";

export const verificationEvidenceActions = [
  "verification.requested",
  "verification.application_updated",
];
/** Every evidence replacement writes a new immutable audit identity in the same transaction. */
export function verificationApplicationRevision(
  id: string,
  status: string,
  eventId: string | null,
) {
  return createHash("sha256")
    .update(JSON.stringify([1, "verification-application", id, status, eventId]))
    .digest("hex");
}
export function verificationEvidenceSubmission(executor: Pick<typeof db, "select">) {
  return executor
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      profileRevision: sql<
        string | null
      >`case when ${auditEvents.details}->>'developerProfileRevision' ~ '^[a-f0-9]{64}$' then ${auditEvents.details}->>'developerProfileRevision' else null end`.as(
        "profile_revision",
      ),
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.targetType, "verification"),
        eq(auditEvents.targetId, verificationRequests.id),
        eq(auditEvents.actorId, verificationRequests.requesterId),
        eq(auditEvents.actorType, "user"),
        inArray(auditEvents.action, verificationEvidenceActions),
      ),
    )
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(1)
    .as("submission");
}
