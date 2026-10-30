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
import { afterEach, expect, it } from "vitest";

const userIds: string[] = [],
  orgIds: string[] = [];
it("queues the ownership notice for an active push subscription in the same authoritative transaction", async () => {
  const f = await fixture(),
    sessionId = `ses_${randomUUID()}`,
    subscriptionId = `wps_${randomUUID()}`;
  await sessionRepository.create({
    id: sessionId,
    userId: f.target.id,
    token: `org-session-${randomUUID()}`,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  await webPushSubscriptionRepository.upsert({
    id: subscriptionId,
    userId: f.target.id,
    sessionId,
    endpoint: `https://push.example.invalid/org-${randomUUID()}`,
    p256dh: "fixture-key",
    auth: "fixture-auth",
    expirationAt: null,
  });
  await transfer(f);
  const [notice] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, f.target.id),
        eq(notifications.message, `Organization ${f.org.id}: ownership_gained.`),
      ),
    );
  expect(
    await db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notice.id)),
  ).toEqual([expect.objectContaining({ subscriptionId, attempts: 0 })]);
});
afterEach(async () => {
  if (orgIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  userIds.length = 0;
  orgIds.length = 0;
});
async function actor() {
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
const audit = (user: User, id: string, action: string) => ({
  id: `aud_${randomUUID()}`,
  actorId: user.id,
  actorType: "user" as const,
  targetType: "organization",
  targetId: id,
  action,
});
async function fixture(role: "member" | "admin" = "member") {
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
  );
  return { owner, target, currentToken, expectedPasswordHash, org: added.organization };
}
const transfer = (
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
it("persists one authoritative owner, both chosen roles, unchanged permissions and two transactional inbox notices", async () => {
  const f = await fixture();
  await db
    .update(organizationMembers)
    .set({ permissions: ["manage_products", "manage_servers", "custom"] })
    .where(eq(organizationMembers.organizationId, f.org.id));
  await transfer(f);
  const stored = await teams.getWorkspace(f.org.id, f.owner.id);
  expect(stored.role).toBe("member");
  expect(stored.organization.ownerId).toBe(f.target.id);
  expect(stored.owner?.id).toBe(f.target.id);
  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, f.org.id));
  expect(members.find((member) => member.userId === f.target.id)).toMatchObject({
    role: "owner",
    permissions: ["manage_products", "manage_servers", "custom"],
  });
  expect(members.find((member) => member.userId === f.owner.id)).toMatchObject({
    role: "member",
    permissions: ["manage_products", "manage_servers", "custom"],
  });
  await expect(governance.history(f.org.id, f.owner.id)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(transfer(f)).rejects.toMatchObject({
    code: "OWNERSHIP_OWNER_REQUIRED",
  });
  expect((await teams.getWorkspace(f.org.id, f.owner.id)).organization.ownerId).toBe(f.target.id);
  expect((await governance.history(f.org.id, f.target.id)).items[0].action).toBe(
    "organization.ownership_transferred",
  );
  const notices = await db
    .select()
    .from(notifications)
    .where(
      and(
        inArray(notifications.recipientId, [f.owner.id, f.target.id]),
        eq(notifications.title, "Organization access changed"),
      ),
    );
  expect(notices.map((notice) => notice.message)).toEqual(
    expect.arrayContaining([
      `Organization ${f.org.id}: ownership_gained.`,
      `Organization ${f.org.id}: ownership_transferred.`,
    ]),
  );
});
it("serializes competing transfers and grants the retained administrator role explicitly", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    transfer(f, { formerOwnerRole: "admin" }),
    transfer(f, { formerOwnerRole: "admin" }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  expect((await teams.getWorkspace(f.org.id, f.owner.id)).role).toBe("admin");
  expect(
    (await governance.history(f.org.id, f.owner.id)).items.filter(
      (item) => item.action === "organization.ownership_transferred",
    ),
  ).toHaveLength(1);
});
it("denies administrator takeover and rejects a removed recipient or changed team revision", async () => {
  const f = await fixture("admin");
  await expect(
    transfer(f, { actorId: f.target.id, targetId: f.owner.id, targetUsername: f.owner.username }),
  ).rejects.toMatchObject({ code: "OWNERSHIP_OWNER_REQUIRED" });
  await teams.changeMember(
    f.org.id,
    f.owner.id,
    f.org.updatedAt,
    f.target.id,
    null,
    audit(f.owner, f.org.id, "organization.member_removed"),
  );
  await expect(transfer(f)).rejects.toMatchObject({ code: "CONFLICT" });
  const fresh = (await teams.getWorkspace(f.org.id, f.owner.id)).organization;
  await expect(transfer({ ...f, org: fresh })).rejects.toMatchObject({
    code: "OWNERSHIP_TARGET_INVALID",
  });
  expect(fresh.ownerId).toBe(f.owner.id);
});
it("repairs a missing legacy owner membership while preserving the verified organization identity", async () => {
  const f = await fixture();
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, f.org.id),
        eq(organizationMembers.userId, f.owner.id),
      ),
    );
  await db.update(organizations).set({ isVerified: true }).where(eq(organizations.id, f.org.id));
  await transfer(f);
  const stored = await teams.getWorkspace(f.org.id, f.owner.id);
  expect(stored.role).toBe("member");
  expect(stored.organization.isVerified).toBe(true);
});
it("rolls back owner, roles and notices on an audit failure", async () => {
  const f = await fixture();
  const badActor = await actor();
  const duplicate = audit(badActor, f.org.id, "fixture");
  await db.insert(auditEvents).values(duplicate);
  await expect(transfer(f, { auditId: duplicate.id })).rejects.toBeDefined();
  const stored = await teams.getWorkspace(f.org.id, f.owner.id);
  expect(stored.role).toBe("owner");
  expect(stored.organization.ownerId).toBe(f.owner.id);
  expect(
    await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, f.target.id),
          eq(notifications.message, `Organization ${f.org.id}: ownership_gained.`),
        ),
      ),
  ).toHaveLength(0);
});
it("paginates tied microsecond events exactly once and hides raw or unrelated audit details", async () => {
  const f = await fixture();
  const events = Array.from({ length: 43 }, (_, index) => ({
    id: `aud_ogov_${randomUUID()}_${String(index).padStart(2, "0")}`,
    actorId: f.owner.id,
    actorType: "user" as const,
    targetId: f.org.id,
    targetType: "organization",
    action: "organization.profile_updated",
    details: {
      fields: ["name", "ownerId", "private-token"],
      password: "PRIVATE",
      permissions: ["manage_products"],
    },
    ipAddress: "PRIVATE",
    userAgent: "PRIVATE",
    createdAt: sql`'2026-10-11T00:00:00.123456Z'::timestamptz`,
  }));
  await db.insert(auditEvents).values(events);
  const ids: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < 4; page++) {
    const result = await governance.history(f.org.id, f.owner.id, before);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|manage_products|private-token/u);
    ids.push(...result.items.map((item) => item.id));
    if (!result.hasMore) break;
    before = result.nextCursor ?? undefined;
  }
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.filter((id) => events.some((event) => event.id === id))).toHaveLength(43);
  const foreign = await fixture();
  await expect(
    governance.history(
      f.org.id,
      f.owner.id,
      (await governance.history(foreign.org.id, foreign.owner.id)).items[0].id,
    ),
  ).rejects.toMatchObject({ code: "ORGANIZATION_HISTORY_EXPIRED" });
});
it("rejects history after administrator access is revoked and keeps removed-access notices public-link safe", async () => {
  const f = await fixture("admin");
  expect((await governance.history(f.org.id, f.target.id)).items.length).toBeGreaterThan(0);
  await teams.changeMember(
    f.org.id,
    f.owner.id,
    f.org.updatedAt,
    f.target.id,
    null,
    audit(f.owner, f.org.id, "organization.member_removed"),
  );
  await expect(governance.history(f.org.id, f.target.id)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const [notice] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, f.target.id),
        eq(notifications.message, `Organization ${f.org.id}: removed.`),
      ),
    );
  expect(notice.link).toBe(`/organizations/${f.org.slug}`);
});
