import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { AppError, NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { developerProfiles, users, verificationRequests } from "../schema";
class PublicVerificationHistoryRepository {
  async page(
    username: string,
    filters: {
      type?: "user" | "developer";
      cursor?: { createdAt: string; id: string; context: string };
    },
  ) {
    return db.transaction(
      async (tx) => {
        const [subject] = await tx
          .select({
            id: users.id,
            username: users.username,
            name: users.displayName,
            identityVerified: users.isVerified,
            developerVerified: sql<boolean>`(${users.role} in ('developer','admin') and coalesce(${developerProfiles.verifiedDeveloper}, false))`,
          })
          .from(users)
          .leftJoin(developerProfiles, eq(developerProfiles.userId, users.id))
          .where(eq(users.username, username))
          .limit(1);
        if (!subject) throw new NotFoundError("Profile");
        const context = createHash("sha256")
          .update(JSON.stringify([1, "public-approvals", subject.id, filters.type ?? ""]))
          .digest("hex");
        if (filters.cursor && filters.cursor.context !== context)
          throw new AppError("Approval page context changed", 400, "INVALID_CURSOR");
        // Stable public record keys never expose application IDs, staff identities or evidence.
        const publicKey = sql<string>`md5(${verificationRequests.id})`;
        const rows = await tx
          .select({
            key: publicKey,
            type: verificationRequests.targetType,
            approvedAt: verificationRequests.resolvedAt,
            cursorTime: sql<string>`to_char(${verificationRequests.resolvedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(verificationRequests)
          .where(
            and(
              eq(verificationRequests.targetId, subject.id),
              eq(verificationRequests.status, "approved"),
              isNotNull(verificationRequests.resolvedAt),
              inArray(
                verificationRequests.targetType,
                filters.type ? [filters.type] : ["user", "developer"],
              ),
              filters.cursor
                ? sql`(${verificationRequests.resolvedAt}, ${publicKey}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(verificationRequests.resolvedAt), desc(publicKey))
          .limit(21);
        const items = rows.slice(0, 20),
          last = items.at(-1);
        return {
          subject: {
            username: subject.username,
            name: subject.name,
            identityVerified: subject.identityVerified,
            developerVerified: subject.developerVerified,
          },
          items,
          context,
          hasMore: rows.length > 20,
          nextCursor:
            rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.key } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const publicVerificationHistoryRepository = new PublicVerificationHistoryRepository();
