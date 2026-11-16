import { eq, sql } from "drizzle-orm";
import { NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { developerProfiles, users } from "../schema";
import { publicApprovalRecords } from "./public-approval-records";
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
        const records = await publicApprovalRecords(
          tx,
          {
            targetId: subject.id,
            types: filters.type ? [filters.type] : ["user", "developer"],
            contextParts: [1, "public-approvals", subject.id, filters.type ?? ""],
          },
          filters.cursor,
        );
        return {
          subject: {
            username: subject.username,
            name: subject.name,
            identityVerified: subject.identityVerified,
            developerVerified: subject.developerVerified,
          },
          ...records,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const publicVerificationHistoryRepository = new PublicVerificationHistoryRepository();
