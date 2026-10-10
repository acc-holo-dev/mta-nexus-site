import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  developerProfiles,
  organizations,
  organizationMembers,
  users,
  verificationRequests,
} from "../schema";
import { containsPattern } from "./search-pattern";
class VerificationWorkspaceRepository {
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
