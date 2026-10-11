import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  auditEvents,
  content,
  db,
  developerProfileRepository,
  developerProfiles,
  follows,
  organizationRepository,
  organizations,
  profilePrivacyRepository as privacy,
  publicationFeedRepository as feed,
  userProfilePreferences,
  userRepository,
  users,
} from "@nexus/db";
const userIds: string[] = [],
  orgIds: string[] = [];
afterEach(async () => {
  if (userIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, userIds));
    await db.delete(follows).where(inArray(follows.followerId, userIds));
    await db.delete(content).where(inArray(content.authorId, userIds));
  }
  if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  userIds.length = 0;
  orgIds.length = 0;
});
async function fixture(role = "developer") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 20);
  const actor = await userRepository.create({
    id: `usr_privacy_${suffix}`,
    username: `privacy_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Privacy fixture",
    role,
  });
  userIds.push(actor.id);
  return actor;
}
async function save(actorId: string, showActivity = false, showProfessionalContacts = false) {
  const previous = await privacy.own(actorId);
  return privacy.update({
    actorId,
    showActivity,
    showProfessionalContacts,
    expectedUpdatedAt: previous.updatedAt,
    auditId: `aud_${randomUUID()}`,
  });
}
it("preserves legacy defaults, persists visibility for every user role, advances revision and audits without changing profile data", async () => {
  const actor = await fixture("user");
  expect(
    await db
      .select()
      .from(userProfilePreferences)
      .where(eq(userProfilePreferences.userId, actor.id)),
  ).toEqual([]);
  expect(await privacy.own(actor.id)).toMatchObject({
    showActivity: true,
    showProfessionalContacts: true,
  });
  const saved = await save(actor.id);
  expect(saved.updatedAt.getTime()).toBeGreaterThan(actor.updatedAt.getTime());
  expect(await privacy.own(actor.id)).toMatchObject({
    showActivity: false,
    showProfessionalContacts: false,
    updatedAt: saved.updatedAt,
  });
  expect(await userRepository.findById(actor.id)).toMatchObject({
    displayName: actor.displayName,
    role: actor.role,
    isVerified: actor.isVerified,
  });
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.targetId, actor.id), eq(auditEvents.action, "user.privacy_updated")),
      ),
  ).toHaveLength(1);
  const restored = await save(actor.id, true, true);
  expect(restored.updatedAt.getTime()).toBeGreaterThan(saved.updatedAt.getTime());
  expect(
    await db
      .select()
      .from(userProfilePreferences)
      .where(eq(userProfilePreferences.userId, actor.id)),
  ).toHaveLength(1);
});
it("nulls public portfolio and Discord while preserving private contacts, experience and commercial counters", async () => {
  const actor = await fixture();
  await db
    .insert(developerProfiles)
    .values({
      id: `dev_${randomUUID()}`,
      userId: actor.id,
      specialties: ["Lua"],
      githubUrl: "https://portfolio.test/private",
      discordTag: "private-discord",
      verifiedDeveloper: true,
      reputationScore: 543,
      completedDealsCount: 8,
    });
  expect(await developerProfileRepository.publicProfile(actor.id)).toMatchObject({
    githubUrl: "https://portfolio.test/private",
    discordTag: "private-discord",
  });
  await save(actor.id, true, false);
  expect(await developerProfileRepository.publicProfile(actor.id)).toEqual({
    specialties: ["Lua"],
    githubUrl: null,
    discordTag: null,
    verifiedDeveloper: true,
  });
  expect(await developerProfileRepository.own(actor.id)).toMatchObject({
    githubUrl: "https://portfolio.test/private",
    discordTag: "private-discord",
    verifiedDeveloper: true,
  });
  expect(
    await db.select().from(developerProfiles).where(eq(developerProfiles.userId, actor.id)),
  ).toEqual([expect.objectContaining({ reputationScore: 543, completedDealsCount: 8 })]);
  await save(actor.id, true, true);
  expect(await developerProfileRepository.publicProfile(actor.id)).toMatchObject({
    githubUrl: "https://portfolio.test/private",
    discordTag: "private-discord",
    verifiedDeveloper: true,
  });
});
it("closes direct and followed-user activity while retaining published content and explicitly followed organization contexts", async () => {
  const actor = await fixture(),
    follower = await fixture("user"),
    orgId = `org_privacy_${randomUUID()}`;
  orgIds.push(orgId);
  await organizationRepository.create({
    id: orgId,
    name: "Privacy context",
    slug: `privacy-${randomUUID()}`,
    ownerId: actor.id,
  });
  const contentId = `cnt_privacy_${randomUUID()}`,
    slug = `privacy-${randomUUID()}`;
  await db
    .insert(content)
    .values({
      id: contentId,
      slug,
      title: "Public contextual publication",
      body: "Published content stays public.",
      type: "post",
      authorId: actor.id,
      organizationId: orgId,
    });
  await db
    .insert(follows)
    .values({
      id: `fol_${randomUUID()}`,
      followerId: follower.id,
      targetType: "user",
      targetId: actor.id,
    });
  expect(await feed.resolvePublicScope("user", actor.username)).toMatchObject({ id: actor.id });
  expect(
    (await feed.page({ kind: "following", actorId: follower.id })).items.map((row) => row.id),
  ).toContain(contentId);
  await save(actor.id, false, true);
  expect(await feed.resolvePublicScope("user", actor.username)).toBeNull();
  expect((await feed.page({ kind: "user", id: actor.id })).items).toEqual([]);
  for (const source of [undefined, "user"] as const)
    expect(
      (await feed.page({ kind: "following", actorId: follower.id }, { source })).items,
    ).toEqual([]);
  expect(
    await db
      .select({ id: content.id })
      .from(content)
      .where(and(eq(content.slug, slug), eq(content.status, "published"))),
  ).toEqual([{ id: contentId }]);
  expect(
    (await feed.page({ kind: "organization", id: orgId })).items.map((row) => row.id),
  ).toContain(contentId);
  await db
    .insert(follows)
    .values({
      id: `fol_${randomUUID()}`,
      followerId: follower.id,
      targetType: "organization",
      targetId: orgId,
    });
  expect(
    (await feed.page({ kind: "following", actorId: follower.id })).items.map((row) => row.id),
  ).toEqual([contentId]);
  expect(
    (await feed.page({ kind: "following", actorId: follower.id }, { source: "user" })).items,
  ).toEqual([]);
});
it("serializes privacy, ordinary and professional profile writers against the same revision without losing another writer's changes", async () => {
  const actor = await fixture(),
    previous = await privacy.own(actor.id);
  const results = await Promise.allSettled([
    privacy.update({
      actorId: actor.id,
      expectedUpdatedAt: previous.updatedAt,
      showActivity: false,
      showProfessionalContacts: false,
      auditId: `aud_${randomUUID()}`,
    }),
    userRepository.updatePublicProfile(
      actor.id,
      previous.updatedAt,
      { displayName: "Concurrent name", bio: "Concurrent biography", avatarUrl: "" },
      `aud_${randomUUID()}`,
    ),
    developerProfileRepository.update({
      actorId: actor.id,
      expectedUpdatedAt: previous.updatedAt,
      specialties: ["Lua"],
      githubUrl: "https://portfolio.test",
      discordTag: "concurrent",
      profileId: `dev_${randomUUID()}`,
      auditId: `aud_${randomUUID()}`,
    }),
  ]);
  const winners = results.filter(
    (result) => result.status === "fulfilled" && result.value !== null,
  );
  expect(winners).toHaveLength(1);
  for (const result of results)
    if (result.status === "rejected") expect(result.reason).toMatchObject({ code: "CONFLICT" });
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.targetId, actor.id)),
  ).toHaveLength(1);
  const current = await privacy.own(actor.id);
  expect(current.updatedAt.getTime()).toBeGreaterThan(previous.updatedAt.getTime());
  await expect(
    privacy.update({
      actorId: actor.id,
      expectedUpdatedAt: previous.updatedAt,
      showActivity: true,
      showProfessionalContacts: true,
      auditId: `aud_${randomUUID()}`,
    }),
  ).rejects.toMatchObject({ code: "CONFLICT" });
});
it("rolls back preferences and shared revision when the mandatory audit cannot be stored", async () => {
  const actor = await fixture(),
    previous = await privacy.own(actor.id),
    auditId = `aud_${randomUUID()}`;
  await db
    .insert(auditEvents)
    .values({
      id: auditId,
      actorId: actor.id,
      actorType: "user",
      action: "fixture",
      targetType: "user",
      targetId: actor.id,
    });
  await expect(
    privacy.update({
      actorId: actor.id,
      expectedUpdatedAt: previous.updatedAt,
      showActivity: false,
      showProfessionalContacts: false,
      auditId,
    }),
  ).rejects.toThrow();
  expect(await privacy.own(actor.id)).toEqual(previous);
  expect(
    await db
      .select()
      .from(userProfilePreferences)
      .where(eq(userProfilePreferences.userId, actor.id)),
  ).toEqual([]);
});
