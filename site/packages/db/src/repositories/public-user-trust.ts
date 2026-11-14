import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  content,
  developerProfiles,
  organizations,
  servers,
  userProfilePreferences,
  users,
  verificationRequests,
} from "../schema";

class PublicUserTrustRepository {
  async find(username: string) {
    const developerVerified = sql<boolean>`(${users.role} in ('developer', 'admin') and coalesce(${developerProfiles.verifiedDeveloper}, false))`;
    const approval = (type: "user" | "developer") =>
      sql<Date | null>`(select max(${verificationRequests.resolvedAt}) from ${verificationRequests} where ${verificationRequests.targetType} = ${type} and ${verificationRequests.targetId} = ${users.id} and ${verificationRequests.status} = 'approved')`;
    // One snapshot, narrow projection: no evidence, reviewer, sanctions or default reputation score.
    const [row] = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        joinedAt: users.createdAt,
        identityVerified: users.isVerified,
        developerVerified,
        identityApprovalAt: sql<Date | null>`case when ${users.isVerified} then ${approval("user")} else null end`,
        developerApprovalAt: sql<Date | null>`case when ${developerVerified} then ${approval("developer")} else null end`,
        servers:
          sql<number>`(select count(*) from ${servers} where ${servers.ownerId} = ${users.id} and ${servers.visibility} = 'public' and ${servers.status} = 'active')`.mapWith(
            Number,
          ),
        verifiedServers:
          sql<number>`(select count(*) from ${servers} where ${servers.ownerId} = ${users.id} and ${servers.visibility} = 'public' and ${servers.status} = 'active' and ${servers.isVerified})`.mapWith(
            Number,
          ),
        organizations:
          sql<number>`(select count(*) from ${organizations} where ${organizations.ownerId} = ${users.id})`.mapWith(
            Number,
          ),
        verifiedOrganizations:
          sql<number>`(select count(*) from ${organizations} where ${organizations.ownerId} = ${users.id} and ${organizations.isVerified})`.mapWith(
            Number,
          ),
        publications: sql<
          number | null
        >`case when coalesce(${userProfilePreferences.showActivity}, true) then (select count(*) from ${content} where ${content.authorId} = ${users.id} and ${content.status} = 'published' and ${content.type} in ('article','news','devlog','update','announcement','post','question','review')) else null end`.mapWith(
          (value) => (value === null ? null : Number(value)),
        ),
      })
      .from(users)
      .leftJoin(developerProfiles, eq(developerProfiles.userId, users.id))
      .leftJoin(userProfilePreferences, eq(userProfilePreferences.userId, users.id))
      .where(eq(users.username, username))
      .limit(1);
    return row ?? null;
  }
}
export const publicUserTrustRepository = new PublicUserTrustRepository();
