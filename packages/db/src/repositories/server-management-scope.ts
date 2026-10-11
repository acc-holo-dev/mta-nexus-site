import { and, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import { organizationMembers, organizations, servers } from "../schema";

/** Current personal/organization grants, evaluated inside the caller's read snapshot. */
export function managedServerScope(userId: string) {
  if (!userId) throw new RangeError("A user ID is required for managed servers");
  return or(
    and(isNull(servers.organizationId), eq(servers.ownerId, userId)),
    exists(
      db
        .select({ id: organizations.id })
        .from(organizations)
        .where(
          and(
            eq(organizations.id, servers.organizationId),
            or(
              eq(organizations.ownerId, userId),
              exists(
                db
                  .select({ id: organizationMembers.id })
                  .from(organizationMembers)
                  .where(
                    and(
                      eq(organizationMembers.organizationId, organizations.id),
                      eq(organizationMembers.userId, userId),
                      or(
                        eq(organizationMembers.role, "admin"),
                        and(inArray(organizationMembers.role, ["member", "developer"]), sql`${organizationMembers.permissions} @> ${JSON.stringify(["manage_servers"])}::jsonb`),
                      ),
                    ),
                  ),
              ),
            ),
          ),
        ),
    ),
  );
}
