import { randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  organizationMembers,
  organizations,
  organizationGovernanceRepository as organizationsHistory,
  type ProfileChangeHistoryRepository,
  profilePrivacyRepository,
  profileChangeHistoryRepository as profiles,
  userRepository,
  users,
} from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";

const actorIds: string[] = [],
  organizationIds: string[] = [];
afterEach(async () => {
  if (organizationIds.length)
    await db.delete(organizations).where(inArray(organizations.id, organizationIds));
  if (actorIds.length) {
    await db
      .delete(auditEvents)
      .where(inArray(auditEvents.targetId, [...actorIds, ...organizationIds]));
    await db.delete(users).where(inArray(users.id, actorIds));
  }
  actorIds.length = 0;
  organizationIds.length = 0;
});
async function actor(displayName = "Writer") {
  const key = randomUUID().replaceAll("-", "");
  const value = await userRepository.create({
    id: `usr_journal_${key}`,
    username: `journal_${key}`,
    email: `${key}@nexus.test`,
    displayName,
    role: "user",
  });
  actorIds.push(value.id);
  return value;
}
const base = { period: "all" as const, group: "all" as const, query: "" };
async function clock() {
  const result = await db.execute<{ time: string }>(
    sql`select to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as time`,
  );
  return result[0].time;
}
async function event(
  actorId: string,
  targetId: string,
  action: string,
  details: Record<string, unknown> = {},
  targetType = "user",
  createdAt?: string,
) {
  const id = `aud_journal_${randomUUID()}`;
  await db.insert(auditEvents).values({
    id,
    actorId,
    targetId,
    targetType,
    action,
    details,
    ipAddress: "private-network",
    userAgent: "private-agent",
    ...(createdAt ? { createdAt: sql`${createdAt}::timestamptz` } : {}),
  });
  return id;
}
async function organization(ownerId: string) {
  const id = `org_journal_${randomUUID()}`;
  organizationIds.push(id);
  await db
    .insert(organizations)
    .values({ id, ownerId, name: "Journal team", slug: `journal-${randomUUID()}` });
  return id;
}
it("reads actual profile/privacy edit audits and never exports their private values or unrelated security/commerce operations", async () => {
  const owner = await actor(),
    other = await actor();
  const changed = await userRepository.updatePublicProfile(
    owner.id,
    owner.updatedAt,
    {
      displayName: "Saved profile",
      bio: "Private biography marker",
      avatarUrl: "https://safe.test/avatar.png",
    },
    `aud_${randomUUID()}`,
  );
  if (!changed) throw Error("Profile write not confirmed");
  await profilePrivacyRepository.update({
    actorId: owner.id,
    expectedUpdatedAt: changed.updatedAt,
    showActivity: false,
    showProfessionalContacts: false,
    auditId: `aud_${randomUUID()}`,
  });
  await event(owner.id, owner.id, "user.password_changed", { password: "private-password" });
  await event(owner.id, owner.id, "order.completed", { receipt: "private-receipt" });
  const page = await profiles.page(owner.id, base);
  expect(page.items).toHaveLength(2);
  expect(page.items.map((item) => item.action)).toEqual([
    "user.privacy_updated",
    "user.profile_updated",
  ]);
  expect(page.items[0].fields).toEqual(["showActivity", "showProfessionalContacts"]);
  expect((await profiles.page(other.id, base)).items).toHaveLength(0);
  expect(JSON.stringify(page)).not.toMatch(/private-|Private biography|avatar\.png|Saved profile/u);
});
it("canonicalizes recorded field labels and treats malformed historical evidence as unknown", async () => {
  const owner = await actor(),
    system = await actor();
  await event(owner.id, owner.id, "user.profile_updated", {
    fields: ["email", "bio", "bio", "showActivity", "password"],
    body: "private-body",
  });
  await event(system.id, owner.id, "developer.profile_updated", {
    fields: ["discordTag", "specialties", "bio"],
    experienceVerificationInvalidated: true,
    discordTag: "private-contact",
  });
  await event(owner.id, owner.id, "user.privacy_updated", {
    fields: "showActivity",
    experienceVerificationInvalidated: "true",
  });
  const page = await profiles.page(owner.id, base);
  expect(page.items.find((item) => item.action === "user.profile_updated")).toMatchObject({
    fields: ["bio"],
    experienceVerificationInvalidated: false,
    actor: "you",
  });
  expect(page.items.find((item) => item.action === "developer.profile_updated")).toMatchObject({
    fields: ["specialties", "discordTag"],
    experienceVerificationInvalidated: true,
    actor: "system",
  });
  expect(page.items.find((item) => item.action === "user.privacy_updated")).toMatchObject({
    fields: [],
    experienceVerificationInvalidated: false,
  });
  expect(JSON.stringify(page)).not.toContain(system.id);
  expect(JSON.stringify(page)).not.toContain("private-");
});
it("traverses forty-five tied profile events once and rejects cursor reuse with another actor or filter", async () => {
  const owner = await actor(),
    other = await actor(),
    time = await clock();
  const ids = Array.from({ length: 45 }, () => `aud_journal_${randomUUID()}`);
  await db.insert(auditEvents).values(
    ids.map((id) => ({
      id,
      actorId: owner.id,
      targetId: owner.id,
      targetType: "user",
      action: "user.profile_updated",
      details: { fields: ["bio"] },
      createdAt: sql`${time}::timestamptz`,
    })),
  );
  const first = await profiles.page(owner.id, base);
  if (!first.nextCursor) throw Error("Missing next cursor");
  expect(first.items[0].createdAt).toBe(time);
  await expect(
    profiles.page(other.id, { ...base, cursor: first.nextCursor }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await expect(
    profiles.page(owner.id, { ...base, group: "privacy", cursor: first.nextCursor }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  const collected = first.items.map((item) => item.id);
  let cursor: Awaited<ReturnType<ProfileChangeHistoryRepository["page"]>>["nextCursor"] =
    first.nextCursor;
  while (cursor) {
    const page = await profiles.page(owner.id, { ...base, cursor });
    collected.push(...page.items.map((item) => item.id));
    expect(page.until).toBe(first.until);
    cursor = page.nextCursor;
  }
  expect(collected).toEqual([...ids].sort().reverse());
  expect(new Set(collected).size).toBe(45);
});
it("retains the reviewed cutoff and handles a removed anchor without shifting to unrelated events", async () => {
  const owner = await actor(),
    time = await clock();
  await event(owner.id, owner.id, "user.profile_updated", { fields: ["bio"] }, "user", time);
  const first = await profiles.page(owner.id, base);
  const future = `aud_future_${randomUUID()}`;
  await db.insert(auditEvents).values({
    id: future,
    actorId: owner.id,
    targetId: owner.id,
    targetType: "user",
    action: "user.profile_updated",
    createdAt: sql`clock_timestamp()+interval '1 hour'`,
  });
  expect(
    (await profiles.page(owner.id, { ...base, until: first.until })).items.map((item) => item.id),
  ).not.toContain(future);
  const id = first.items[0].id;
  await db.delete(auditEvents).where(eq(auditEvents.id, id));
  const { createHash } = await import("node:crypto");
  const context = createHash("sha256")
    .update(JSON.stringify([1, "profile-change-history", owner.id, owner.id, "all", "all", ""]))
    .digest("hex");
  await expect(
    profiles.page(owner.id, { ...base, cursor: { version: 1, context, until: first.until, id } }),
  ).rejects.toMatchObject({ code: "CHANGE_HISTORY_EXPIRED" });
});
it("searches organization actors/subjects literally and protects history after a current administrator is revoked", async () => {
  const owner = await actor("Actor%_Marker"),
    admin = await actor(),
    subject = await actor("Subject%_Marker"),
    id = await organization(owner.id);
  await db.insert(organizationMembers).values({
    id: `mem_${randomUUID()}`,
    organizationId: id,
    userId: admin.id,
    role: "admin",
    permissions: [],
  });
  await event(
    owner.id,
    id,
    "organization.member_updated",
    { userId: subject.id, from: "member", to: "developer", managesServers: true },
    "organization",
  );
  await event(owner.id, id, "organization.profile_updated", { fields: ["name"] }, "organization");
  const filtered = await organizationsHistory.history(id, admin.id, undefined, {
    ...base,
    group: "team",
    query: "%_Marker",
  });
  expect(filtered.items).toHaveLength(1);
  expect(filtered.items[0]).toMatchObject({
    action: "organization.member_updated",
    subjectName: "Subject%_Marker",
    fromRole: "member",
    toRole: "developer",
    managesServers: true,
  });
  expect(JSON.stringify(filtered)).not.toMatch(
    /private-network|private-agent|permissions|"userId"/u,
  );
  await db
    .delete(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, id), eq(organizationMembers.userId, admin.id)),
    );
  await expect(organizationsHistory.history(id, admin.id, undefined, base)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("preserves old organization anchors while scoping new cursors to groups, searches and managers", async () => {
  const owner = await actor(),
    id = await organization(owner.id),
    time = await clock();
  const ids = Array.from({ length: 25 }, () => `aud_journal_${randomUUID()}`);
  await db.insert(auditEvents).values(
    ids.map((key) => ({
      id: key,
      actorId: owner.id,
      targetId: id,
      targetType: "organization",
      action: "organization.member_left",
      details: { userId: owner.id },
      createdAt: sql`${time}::timestamptz`,
    })),
  );
  const first = await organizationsHistory.history(id, owner.id, undefined, base);
  if (!first.nextCursor || typeof first.nextCursor === "string")
    throw Error("Missing bound cursor");
  const next = await organizationsHistory.history(id, owner.id, undefined, {
    ...base,
    cursor: first.nextCursor,
  });
  expect([...first.items, ...next.items].map((item) => item.id)).toEqual([...ids].sort().reverse());
  expect(
    (await organizationsHistory.history(id, owner.id, first.items.at(-1)?.id)).items,
  ).toHaveLength(5);
  await expect(
    organizationsHistory.history(id, owner.id, undefined, {
      ...base,
      group: "team",
      cursor: first.nextCursor,
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
