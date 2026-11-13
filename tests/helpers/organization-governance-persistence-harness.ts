import { randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  organizationGovernanceRepository as governance,
  notifications,
  organizationMembers,
  organizations,
  sessionRepository,
  organizationWorkspaceRepository as teams,
  userRepository,
  users,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "@nexus/db";
import type { User } from "@nexus/domain";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach } from "vitest";
import { digestSessionToken } from "../../site/packages/db/src/repositories/sessions";
import { sessions } from "../../site/packages/db/src/schema";

export {
  and,
  auditEvents,
  db,
  digestSessionToken,
  eq,
  governance,
  inArray,
  notifications,
  organizationMembers,
  organizations,
  randomUUID,
  sessionRepository,
  sessions,
  sql,
  teams,
  webPushOutbox,
  webPushSubscriptionRepository,
};

/** Build a deferred promise used by session-expiry concurrency fixtures. */
export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const userIds: string[] = [],
  orgIds: string[] = [];

/** Register shared afterEach cleanup for organization-governance persistence suites. */
export function setupOrganizationGovernancePersistence() {
  afterEach(async () => {
    if (orgIds.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.targetId, orgIds));
      await db.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
    orgIds.length = 0;
  });
}

/** Create a disposable governance actor. */
export async function actor() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const user = await userRepository.create({
    id: `usr_ogov_${suffix}`,
    username: `ogov_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Governance fixture",
    role: "user",
  });
  userIds.push(user.id);
  return user;
}

/** Audit envelope used by organization workspace and governance commands. */
export const audit = (user: User, id: string, action: string) => ({
  id: `aud_${randomUUID()}`,
  actorId: user.id,
  actorType: "user" as const,
  targetType: "organization",
  targetId: id,
  action,
});

/** Seed owner/target membership with an initiating owner session. */
export async function fixture(role: "member" | "admin" = "member") {
  const owner = await actor(),
    target = await actor(),
    id = `org_ogov_${randomUUID()}`;
  const currentToken = `org-owner-${randomUUID()}`;
  const expectedPasswordHash = `hash_${owner.id}`;
  await db.update(users).set({ passwordHash: expectedPasswordHash }).where(eq(users.id, owner.id));
  await sessionRepository.create({
    id: `ses_${randomUUID()}`,
    userId: owner.id,
    token: currentToken,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  orgIds.push(id);
  const org = await teams.create(
    id,
    owner.id,
    `ogov-${randomUUID()}`,
    { name: "Governance fixture", description: "", logoUrl: "", websiteUrl: "" },
    audit(owner, id, "organization.created"),
    currentToken,
  );
  const added = await teams.addMember(
    id,
    owner.id,
    org.updatedAt,
    target.username,
    role,
    true,
    `mem_${randomUUID()}`,
    audit(owner, id, "organization.member_added"),
    currentToken,
  );
  return { owner, target, currentToken, expectedPasswordHash, org: added.organization };
}

/** Transfer ownership using fixture defaults with optional overrides. */
export const transfer = (
  { org, owner, target, currentToken, expectedPasswordHash }: Awaited<ReturnType<typeof fixture>>,
  extra = {},
) =>
  governance.transfer({
    id: org.id,
    actorId: owner.id,
    currentToken,
    targetId: target.id,
    targetUsername: target.username,
    confirmationSlug: org.slug,
    expectedPasswordHash,
    expectedUpdatedAt: org.updatedAt,
    formerOwnerRole: "member",
    memberId: `mem_${randomUUID()}`,
    auditId: `aud_${randomUUID()}`,
    ...extra,
  });
