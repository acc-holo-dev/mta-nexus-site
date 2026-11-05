import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  content,
  db,
  organizationTeamDirectoryRepository as directory,
  organizationWorkspaceRepository as management,
  notifications,
  organizationMembers,
  organizations,
  servers,
  sessionRepository,
  publicContextTrustRepository as trust,
  userRepository,
  users,
  verificationRequests,
} from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach } from "vitest";

export {
  and,
  auditEvents,
  content,
  createHash,
  db,
  directory,
  eq,
  management,
  notifications,
  organizationMembers,
  organizations,
  randomUUID,
  servers,
  sql,
  trust,
  users,
  verificationRequests,
};

const actorIds: string[] = [],
  orgIds: string[] = [],
  serverIds: string[] = [];

/** Fixed microsecond timestamp used by cursor-boundary fixtures. */
export const time = "2026-10-11T00:00:00.123456Z";

/** Register shared afterEach cleanup for context/trust/team persistence suites. */
export function setupContextTrustTeamPersistence() {
  afterEach(async () => {
    if (actorIds.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.actorId, actorIds));
      await db.delete(content).where(inArray(content.authorId, actorIds));
    }
    if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
    if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
    if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
    actorIds.length = 0;
    orgIds.length = 0;
    serverIds.length = 0;
  });
}

/** Create a disposable actor with a live initiating session. */
export async function actor(role = "user") {
  const key = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_trust_${key}`,
    username: `trust_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Trust fixture",
    role,
  });
  actorIds.push(user.id);
  await sessionRepository.create({
    id: `ses_${randomUUID()}`,
    userId: user.id,
    token: `org-test-${user.id}`,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return user;
}

/** Track externally inserted actor ids for shared cleanup. */
export function trackActors(...ids: string[]) {
  actorIds.push(...ids);
}

/** Create a disposable organization owned by `ownerId`. */
export async function organization(ownerId: string) {
  const id = `org_trust_${randomUUID()}`;
  orgIds.push(id);
  const [row] = await db
    .insert(organizations)
    .values({ id, slug: `trust-${randomUUID()}`, name: "Public organization", ownerId })
    .returning();
  return row;
}

/** Create a disposable server optionally bound to an organization. */
export async function server(
  organizationId: string | null,
  extra: Partial<typeof servers.$inferInsert> = {},
) {
  const id = `srv_trust_${randomUUID()}`;
  serverIds.push(id);
  const [row] = await db
    .insert(servers)
    .values({
      id,
      slug: `trust-${randomUUID()}`,
      name: "Public server",
      ipAddress: `fixture-${id}`,
      organizationId,
      ...extra,
    })
    .returning();
  return row;
}

/** Insert an organization membership row. */
export async function member(
  organizationId: string,
  userId: string,
  role = "member",
  permissions: string[] = [],
) {
  const [row] = await db
    .insert(organizationMembers)
    .values({ id: `mem_trust_${randomUUID()}`, organizationId, userId, role, permissions })
    .returning();
  return row;
}

/** Audit envelope used by organization member-change commands. */
export const audit = (actorId: string, targetId: string, id = `aud_${randomUUID()}`) => ({
  id,
  actorId,
  actorType: "user" as const,
  action: "organization.member_updated",
  targetType: "organization",
  targetId,
});
