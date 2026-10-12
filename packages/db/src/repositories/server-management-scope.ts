import { AppError, grantsServerManagement } from "@nexus/domain";
import { and, asc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import { organizationMembers, organizations, servers, users } from "../schema";

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
                        and(
                          inArray(organizationMembers.role, ["member", "developer"]),
                          sql`${organizationMembers.permissions} @> ${JSON.stringify(["manage_servers"])}::jsonb`,
                        ),
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

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ManagedIdentity = { id: string; ownerId: string | null; organizationId: string | null };
/** Call after locking all affected listings in ID order. One read per authority table. */
export async function lockServerManagementGrants(
  tx: Transaction,
  rows: ManagedIdentity[],
  actorId: string,
) {
  const [actor] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .for("share")
    .limit(1);
  if (!actor) throw new AppError("Account unavailable", 403, "FORBIDDEN");
  if (actor.role === "admin") return { role: actor.role, organizations: [], members: [] };
  if (rows.some((row) => !row.organizationId && row.ownerId !== actorId))
    throw new AppError("Server manager required", 403, "FORBIDDEN");
  const orgIds = [
    ...new Set(rows.flatMap((row) => (row.organizationId ? [row.organizationId] : []))),
  ].sort();
  const teams = orgIds.length
    ? await tx
        .select({ id: organizations.id, ownerId: organizations.ownerId })
        .from(organizations)
        .where(inArray(organizations.id, orgIds))
        .orderBy(asc(organizations.id))
        .for("share")
    : [];
  if (teams.length !== orgIds.length)
    throw new AppError("Server organization unavailable", 403, "FORBIDDEN");
  const delegated = teams.filter((team) => team.ownerId !== actorId).map((team) => team.id);
  const members = delegated.length
    ? await tx
        .select({
          organizationId: organizationMembers.organizationId,
          role: organizationMembers.role,
          permissions: organizationMembers.permissions,
        })
        .from(organizationMembers)
        .where(
          and(
            inArray(organizationMembers.organizationId, delegated),
            eq(organizationMembers.userId, actorId),
          ),
        )
        .orderBy(asc(organizationMembers.organizationId))
        .for("share")
    : [];
  if (
    delegated.some(
      (id) => !grantsServerManagement(members.find((member) => member.organizationId === id)),
    )
  )
    throw new AppError("Server manager required", 403, "FORBIDDEN");
  return {
    role: actor.role,
    organizations: teams,
    members: members.map((member) => ({
      ...member,
      permissions: Array.isArray(member.permissions) ? [...member.permissions].sort() : [],
    })),
  };
}
