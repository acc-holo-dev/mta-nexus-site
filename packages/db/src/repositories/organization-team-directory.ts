import { createHash } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { AppError } from "@nexus/domain";
import { db } from "../client";
import { organizationMembers, users } from "../schema";
import { organizationWorkspaceAccess } from "./organization-workspace";
import { containsPattern } from "./search-pattern";
class OrganizationTeamDirectoryRepository {
  async page(
    id: string,
    actorId: string,
    filters: {
      query: string;
      role?: "admin" | "developer" | "member" | "other";
      access?: "yes" | "no";
      cursor?: { createdAt: string; id: string; context: string };
    },
  ) {
    return db.transaction(
      async (tx) => {
        const { organization, role } = await organizationWorkspaceAccess(tx, id, actorId);
        const context = createHash("sha256")
          .update(
            JSON.stringify([
              1,
              "organization-team",
              actorId,
              id,
              filters.query,
              filters.role ?? "",
              filters.access ?? "",
            ]),
          )
          .digest("hex");
        if (filters.cursor && filters.cursor.context !== context)
          throw new AppError("Team page context changed", 400, "INVALID_CURSOR");
        const identity = {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        };
        const [owner] = await tx
          .select(identity)
          .from(users)
          .where(eq(users.id, organization.ownerId))
          .limit(1);
        const pattern = filters.query ? containsPattern(filters.query) : undefined;
        const effective = sql<boolean>`(${organizationMembers.role} = 'admin' or (${organizationMembers.role} in ('member','developer') and ${organizationMembers.permissions} @> '["manage_servers"]'::jsonb))`;
        const rows = await tx
          .select({
            ...identity,
            role: organizationMembers.role,
            managesServers: sql<boolean>`${organizationMembers.permissions} @> '["manage_servers"]'::jsonb`,
            effectiveServerAccess: effective,
            joinedAt: organizationMembers.createdAt,
            membershipId: organizationMembers.id,
            cursorTime: sql<string>`to_char(${organizationMembers.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(organizationMembers)
          .innerJoin(users, eq(users.id, organizationMembers.userId))
          .where(
            and(
              eq(organizationMembers.organizationId, id),
              sql`${organizationMembers.userId} <> ${organization.ownerId}`,
              pattern
                ? or(ilike(users.username, pattern), ilike(users.displayName, pattern))
                : undefined,
              filters.role === "other"
                ? sql`${organizationMembers.role} not in ('admin','developer','member')`
                : filters.role
                  ? eq(organizationMembers.role, filters.role)
                  : undefined,
              filters.access === "yes"
                ? effective
                : filters.access === "no"
                  ? sql`not ${effective}`
                  : undefined,
              filters.cursor
                ? sql`(${organizationMembers.createdAt}, ${organizationMembers.id}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(organizationMembers.createdAt), desc(organizationMembers.id))
          .limit(21);
        const members = rows.slice(0, 20),
          last = members.at(-1);
        return {
          organization,
          role,
          owner: owner ?? null,
          members,
          context,
          hasMore: rows.length > 20,
          nextCursor:
            rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.membershipId } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const organizationTeamDirectoryRepository = new OrganizationTeamDirectoryRepository();
