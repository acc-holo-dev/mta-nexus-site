import { createHash } from "node:crypto";
import type { AuditEvent } from "@nexus/domain";
import { AppError, NotFoundError } from "@nexus/domain";
import { and, asc, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  developerProfiles,
  organizationMembers,
  organizations,
  users,
  verificationRequests,
} from "../schema";
import { developerExperienceRevision } from "./developer-profile";
import { containsPattern } from "./search-pattern";
import {
  verificationApplicationRevision,
  verificationEvidenceActions,
  verificationEvidenceSubmission,
} from "./verification-application-version";
import { verificationTargetAuthority } from "./verification-authority";

type ApplicationCursor = {
  createdAt: string;
  id: string;
  context: string;
  direction: "older" | "newer";
};
const exactCreatedAt = sql<string>`to_char(${verificationRequests.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
class VerificationWorkspaceRepository {
  async applications(
    actorId: string,
    filters: { query: string; status: string; type: string; cursor?: ApplicationCursor },
  ) {
    const context = createHash("sha256")
      .update(
        JSON.stringify([
          1,
          "verification-applications",
          actorId,
          filters.query,
          filters.status,
          filters.type,
        ]),
      )
      .digest("hex");
    if (filters.cursor && filters.cursor.context !== context)
      throw new AppError("Application filters changed", 400, "INVALID_CURSOR");
    const pattern = filters.query ? containsPattern(filters.query) : undefined,
      newer = filters.cursor?.direction === "newer";
    const rows = await db
      .select({
        id: verificationRequests.id,
        targetType: verificationRequests.targetType,
        status: verificationRequests.status,
        createdAt: exactCreatedAt,
        resolvedAt: verificationRequests.resolvedAt,
        notes: sql<string | null>`left(${verificationRequests.notes},240)`,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.requesterId, actorId),
          inArray(verificationRequests.targetType, ["user", "developer", "organization", "server"]),
          inArray(verificationRequests.status, ["pending", "approved", "rejected"]),
          filters.type !== "all" ? eq(verificationRequests.targetType, filters.type) : undefined,
          filters.status !== "all" ? eq(verificationRequests.status, filters.status) : undefined,
          pattern
            ? or(
                ilike(verificationRequests.notes, pattern),
                ilike(verificationRequests.reviewNotes, pattern),
                ilike(verificationRequests.id, pattern),
              )
            : undefined,
          filters.cursor
            ? newer
              ? sql`(${verificationRequests.createdAt},${verificationRequests.id}) > (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
              : sql`(${verificationRequests.createdAt},${verificationRequests.id}) < (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
            : undefined,
        ),
      )
      .orderBy(
        newer ? asc(verificationRequests.createdAt) : desc(verificationRequests.createdAt),
        newer ? asc(verificationRequests.id) : desc(verificationRequests.id),
      )
      .limit(21);
    const items = rows.slice(0, 20);
    if (newer) items.reverse();
    const point = (
      item: (typeof items)[number] | undefined,
      direction: "older" | "newer",
      enabled: boolean,
    ) =>
      item && enabled
        ? JSON.stringify({ createdAt: item.createdAt, id: item.id, context, direction, version: 1 })
        : null;
    return {
      items,
      olderCursor: point(items.at(-1), "older", newer ? !!filters.cursor : rows.length > 20),
      newerCursor: point(items[0], "newer", newer ? rows.length > 20 : !!filters.cursor),
    };
  }
  async application(actorId: string, id: string) {
    return db.transaction(
      async (tx) => {
        const submission = verificationEvidenceSubmission(tx);
        const [row] = await tx
          .select({
            id: verificationRequests.id,
            targetType: verificationRequests.targetType,
            targetId: verificationRequests.targetId,
            status: verificationRequests.status,
            proofUrl: sql<
              string | null
            >`case when length(${verificationRequests.proofUrl}) <= 2048 then ${verificationRequests.proofUrl} else null end`,
            notes: sql<string | null>`left(${verificationRequests.notes},1000)`,
            reviewNotes: sql<string | null>`left(${verificationRequests.reviewNotes},2000)`,
            truncated: sql<boolean>`coalesce(length(${verificationRequests.notes}),0) > 1000 or coalesce(length(${verificationRequests.reviewNotes}),0) > 2000 or coalesce(length(${verificationRequests.proofUrl}),0) > 2048`,
            createdAt: exactCreatedAt,
            resolvedAt: verificationRequests.resolvedAt,
            eventId: submission.id,
            submittedProfileRevision: submission.profileRevision,
          })
          .from(verificationRequests)
          .leftJoinLateral(submission, sql`true`)
          .where(
            and(
              eq(verificationRequests.id, id),
              eq(verificationRequests.requesterId, actorId),
              inArray(verificationRequests.targetType, [
                "user",
                "developer",
                "organization",
                "server",
              ]),
              inArray(verificationRequests.status, ["pending", "approved", "rejected"]),
            ),
          )
          .limit(1);
        if (!row) throw new NotFoundError("Application");
        let profileState: "current" | "changed" | "unknown" | null = null;
        if (row.targetType === "developer" && row.targetId === actorId) {
          const [profile] = await tx
            .select({
              specialties: developerProfiles.specialties,
              githubUrl: developerProfiles.githubUrl,
            })
            .from(developerProfiles)
            .where(eq(developerProfiles.userId, actorId))
            .limit(1);
          profileState = !row.submittedProfileRevision
            ? "unknown"
            : profile && developerExperienceRevision(profile) === row.submittedProfileRevision
              ? "current"
              : "changed";
        }
        const events = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.targetType, "verification"),
              eq(auditEvents.targetId, id),
              inArray(auditEvents.action, [
                ...verificationEvidenceActions,
                "verification.approved",
                "verification.rejected",
              ]),
            ),
          )
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        return {
          row,
          profileState,
          revision: verificationApplicationRevision(row.id, row.status, row.eventId),
          events: events.slice(0, 20),
          hasEarlierEvents: events.length > 20,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async amend(
    actorId: string,
    id: string,
    input: { expectedRevision: string; proofUrl: string; notes: string },
    audit: Omit<AuditEvent, "createdAt">,
  ) {
    return db.transaction(async (tx) => {
      // Same request -> target lock order as moderator decisions. A profile edit
      // locks its user first, so the evidence stamp describes the locked profile.
      const [request] = await tx
        .select()
        .from(verificationRequests)
        .where(and(eq(verificationRequests.id, id), eq(verificationRequests.requesterId, actorId)))
        .for("update")
        .limit(1);
      if (!request) throw new NotFoundError("Application");
      if (request.status !== "pending")
        throw new AppError("Application resolved", 409, "VERIFICATION_APPLICATION_CHANGED");
      if (!["user", "developer", "organization"].includes(request.targetType))
        throw new AppError(
          "Control proof cannot be replaced",
          422,
          "VERIFICATION_APPLICATION_READ_ONLY",
        );
      const [submission] = await tx
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.targetType, "verification"),
            eq(auditEvents.targetId, id),
            eq(auditEvents.actorId, actorId),
            eq(auditEvents.actorType, "user"),
            inArray(auditEvents.action, verificationEvidenceActions),
          ),
        )
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(1);
      if (
        verificationApplicationRevision(id, request.status, submission?.id ?? null) !==
        input.expectedRevision
      )
        throw new AppError("Evidence changed", 409, "VERIFICATION_APPLICATION_CHANGED");
      const profileRevision = await verificationTargetAuthority(
        tx,
        actorId,
        request.targetType,
        request.targetId,
        true,
      );
      await tx
        .update(verificationRequests)
        .set({ proofUrl: input.proofUrl, notes: input.notes })
        .where(eq(verificationRequests.id, id));
      await tx.insert(auditEvents).values({
        ...audit,
        actorId,
        actorType: "user",
        action: "verification.application_updated",
        targetId: id,
        targetType: "verification",
        details: { ...(profileRevision ? { developerProfileRevision: profileRevision } : {}) },
        createdAt: sql`greatest(clock_timestamp(),coalesce((select max(previous.created_at) from audit_events previous where previous.target_type = 'verification' and previous.target_id = ${id} and previous.actor_id = ${actorId} and previous.actor_type = 'user' and previous.action in ('verification.requested','verification.application_updated')),'-infinity'::timestamptz) + interval '1 microsecond')`,
      });
      return {
        id,
        status: "pending" as const,
        revision: verificationApplicationRevision(id, "pending", audit.id),
      };
    });
  }
  async profile(actorId: string) {
    const [row] = await db
      .select({
        id: users.id,
        username: users.username,
        name: users.displayName,
        role: users.role,
        identityVerified: users.isVerified,
        experienceVerified: developerProfiles.verifiedDeveloper,
        hasSpecialties: sql<boolean>`coalesce(jsonb_array_length(${developerProfiles.specialties}), 0) > 0`,
        identityPending: sql<boolean>`exists(select 1 from ${verificationRequests} where ${verificationRequests.targetType} = 'user' and ${verificationRequests.targetId} = ${users.id} and ${verificationRequests.status} = 'pending')`,
        experiencePending: sql<boolean>`exists(select 1 from ${verificationRequests} where ${verificationRequests.targetType} = 'developer' and ${verificationRequests.targetId} = ${users.id} and ${verificationRequests.status} = 'pending')`,
      })
      .from(users)
      .leftJoin(developerProfiles, eq(developerProfiles.userId, users.id))
      .where(eq(users.id, actorId))
      .limit(1);
    return row ?? null;
  }
  async targets(actorId: string, page: number, query: string) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 9999)
      throw new RangeError("Invalid page");
    const pattern = query ? containsPattern(query.slice(0, 100)) : undefined;
    const rows = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        verified: organizations.isVerified,
        pending: sql<boolean>`exists(select 1 from ${verificationRequests} where ${verificationRequests.targetType} = 'organization' and ${verificationRequests.targetId} = ${organizations.id} and ${verificationRequests.status} = 'pending')`,
      })
      .from(organizations)
      .where(
        and(
          or(
            eq(organizations.ownerId, actorId),
            exists(
              db
                .select({ id: organizationMembers.id })
                .from(organizationMembers)
                .where(
                  and(
                    eq(organizationMembers.organizationId, organizations.id),
                    eq(organizationMembers.userId, actorId),
                    eq(organizationMembers.role, "admin"),
                  ),
                ),
            ),
          ),
          pattern
            ? or(ilike(organizations.name, pattern), ilike(organizations.slug, pattern))
            : undefined,
        ),
      )
      .orderBy(desc(organizations.createdAt), desc(organizations.id))
      .limit(21)
      .offset((page - 1) * 20);
    return { items: rows.slice(0, 20), page, hasMore: rows.length > 20 };
  }
  async history(
    actorId: string,
    filters: { view: "pending" | "history"; page: number; type?: string },
  ) {
    if (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > 9999)
      throw new RangeError("Invalid page");
    const rows = await db
      .select({
        id: verificationRequests.id,
        targetType: verificationRequests.targetType,
        targetId: verificationRequests.targetId,
        status: verificationRequests.status,
        proofUrl: verificationRequests.proofUrl,
        notes: verificationRequests.notes,
        reviewNotes: verificationRequests.reviewNotes,
        createdAt: verificationRequests.createdAt,
        resolvedAt: verificationRequests.resolvedAt,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.requesterId, actorId),
          inArray(
            verificationRequests.status,
            filters.view === "pending" ? ["pending"] : ["approved", "rejected"],
          ),
          filters.type ? eq(verificationRequests.targetType, filters.type) : undefined,
        ),
      )
      .orderBy(desc(verificationRequests.createdAt), desc(verificationRequests.id))
      .limit(21)
      .offset((filters.page - 1) * 20);
    return {
      items: rows.slice(0, 20),
      page: filters.page,
      view: filters.view,
      hasMore: rows.length > 20,
    };
  }
}
export const verificationWorkspaceRepository = new VerificationWorkspaceRepository();
