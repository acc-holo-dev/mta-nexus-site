import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  auditEvents,
  content,
  db,
  notifications,
  organizationMembers,
  organizations,
  organizationTeamDirectoryRepository as directory,
  organizationWorkspaceRepository as management,
  publicContextTrustRepository as trust,
  servers,
  userRepository,
  users,
  verificationRequests,
} from "@nexus/db";

const actorIds: string[] = [],
  orgIds: string[] = [],
  serverIds: string[] = [];
const time = "2026-10-11T00:00:00.123456Z";
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
async function actor(role = "user") {
  const key = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_trust_${key}`,
    username: `trust_${key}`,
    email: `${key}@nexus.test`,
    displayName: "Trust fixture",
    role,
  });
  actorIds.push(user.id);
  return user;
}
async function organization(ownerId: string) {
  const id = `org_trust_${randomUUID()}`;
  orgIds.push(id);
  const [row] = await db
    .insert(organizations)
    .values({ id, slug: `trust-${randomUUID()}`, name: "Public organization", ownerId })
    .returning();
  return row;
}
async function server(
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
async function member(
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
const audit = (actorId: string, targetId: string, id = `aud_${randomUUID()}`) => ({
  id,
  actorId,
  actorType: "user" as const,
  action: "organization.member_updated",
  targetType: "organization",
  targetId,
});

it("correlates each public count to the selected organization and excludes private, inactive and commercial rows", async () => {
  const owner = await actor(),
    org = await organization(owner.id),
    other = await organization(owner.id);
  const publicServer = await server(org.id, { isVerified: true });
  await server(org.id);
  await server(org.id, { visibility: "private", isVerified: true });
  await server(org.id, { visibility: "unlisted", isVerified: true });
  await server(org.id, { status: "inactive", isVerified: true });
  await server(other.id, { isVerified: true });
  const base = {
    authorId: owner.id,
    title: "Public item",
    body: "Fixture",
    type: "post",
    status: "published",
  };
  await db.insert(content).values([
    { ...base, id: `cnt_${randomUUID()}`, slug: `trust-${randomUUID()}`, organizationId: org.id },
    {
      ...base,
      id: `cnt_${randomUUID()}`,
      slug: `trust-${randomUUID()}`,
      organizationId: org.id,
      serverId: publicServer.id,
    },
    {
      ...base,
      id: `cnt_${randomUUID()}`,
      slug: `trust-${randomUUID()}`,
      organizationId: org.id,
      status: "draft",
    },
    {
      ...base,
      id: `cnt_${randomUUID()}`,
      slug: `trust-${randomUUID()}`,
      organizationId: org.id,
      type: "resource",
    },
    { ...base, id: `cnt_${randomUUID()}`, slug: `trust-${randomUUID()}`, organizationId: other.id },
    { ...base, id: `cnt_${randomUUID()}`, slug: `trust-${randomUUID()}` },
  ]);
  expect((await trust.page("organization", org.slug)).subject).toMatchObject({
    publications: 2,
    servers: { total: 2, verified: 1 },
  });
  expect((await trust.page("organization", other.slug)).subject).toMatchObject({
    publications: 1,
    servers: { total: 1, verified: 1 },
  });
  expect((await trust.page("server", publicServer.slug)).subject.publications).toBe(1);
});
it("rechecks server visibility and current ownership context without exposing endpoint or personal identity", async () => {
  const owner = await actor(),
    org = await organization(owner.id),
    item = await server(org.id, { ownerId: owner.id });
  expect((await trust.page("server", item.slug)).subject).toMatchObject({
    ownershipKind: "organization",
    organization: { slug: org.slug },
  });
  await db.update(servers).set({ organizationId: null }).where(eq(servers.id, item.id));
  const personal = await trust.page("server", item.slug);
  expect(personal.subject).toMatchObject({ ownershipKind: "personal", organization: null });
  expect(JSON.stringify(personal)).not.toMatch(/ownerId|ipAddress|port|email|usr_trust_/u);
  await db.update(servers).set({ ownerId: null }).where(eq(servers.id, item.id));
  expect((await trust.page("server", item.slug)).subject.ownershipKind).toBe("unclaimed");
  for (const fields of [
    { visibility: "private", status: "active" },
    { visibility: "unlisted", status: "active" },
    { visibility: "public", status: "inactive" },
  ]) {
    await db.update(servers).set(fields).where(eq(servers.id, item.id));
    await expect(trust.page("server", item.slug)).rejects.toMatchObject({ code: "NOT_FOUND" });
  }
});
it("traverses tied microsecond context approvals exactly once and binds cursors to kind and subject independently of current flags", async () => {
  const owner = await actor(),
    org = await organization(owner.id),
    other = await organization(owner.id),
    item = await server(org.id);
  const requests = Array.from({ length: 43 }, (_, i) => ({
    id: `vrf_trust_${i}_${randomUUID()}`,
    requesterId: owner.id,
    targetId: org.id,
    targetType: "organization",
    status: "approved",
    resolvedAt: sql`${time}::timestamptz`,
    proofUrl: "https://private.test/proof",
    reviewNotes: "PRIVATE_PROOF",
    reviewerId: owner.id,
  }));
  await db.insert(verificationRequests).values([
    ...requests,
    ...["pending", "rejected"].map((status) => ({
      ...requests[0],
      id: `vrf_${randomUUID()}`,
      status,
    })),
    { ...requests[0], id: `vrf_${randomUUID()}`, resolvedAt: null },
    { ...requests[0], id: `vrf_${randomUUID()}`, targetType: "server" },
    { ...requests[0], id: `vrf_${randomUUID()}`, targetId: other.id },
  ]);
  const first = await trust.page("organization", org.slug),
    keys: string[] = [];
  let cursor: { createdAt: string; id: string; context: string } | undefined;
  for (let i = 0; i < 4; i++) {
    const page = await trust.page("organization", org.slug, cursor);
    expect(page.subject.verified).toBe(false);
    expect(JSON.stringify(page)).not.toMatch(
      /PRIVATE_PROOF|proofUrl|reviewNotes|requesterId|reviewerId|vrf_/u,
    );
    keys.push(...page.items.map((record) => record.key));
    if (!page.nextCursor) break;
    expect(page.nextCursor.createdAt).toBe(time);
    cursor = { ...page.nextCursor, context: page.context };
  }
  expect(keys).toEqual(
    requests
      .map((record) => createHash("md5").update(record.id).digest("hex"))
      .sort()
      .reverse(),
  );
  expect(new Set(keys).size).toBe(43);
  if (!first.nextCursor) throw new Error("Expected another approval page");
  const bound = { ...first.nextCursor, context: first.context };
  await expect(trust.page("organization", other.slug, bound)).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  await expect(trust.page("server", item.slug, bound)).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  await db.update(organizations).set({ isVerified: true }).where(eq(organizations.id, org.id));
  expect((await trust.page("organization", org.slug)).subject.verified).toBe(true);
});
it("traverses membership keys at exact microsecond boundaries and binds pages to current account, organization and filters", async () => {
  const owner = await actor(),
    org = await organization(owner.id),
    other = await organization(owner.id),
    reader = await actor();
  const people = Array.from({ length: 43 }, (_, i) => {
    const key = randomUUID().replaceAll("-", "");
    return {
      id: `usr_trust_${key}`,
      username: `trust_${key}`,
      email: `${key}@nexus.test`,
      displayName: `Team ${i}`,
    };
  });
  actorIds.push(...people.map((row) => row.id));
  await db.insert(users).values(people);
  const memberships = people.map((person) => ({
    id: `mem_${randomUUID()}`,
    organizationId: org.id,
    userId: person.id,
    role: "member",
    createdAt: sql`${time}::timestamptz`,
  }));
  await db.insert(organizationMembers).values(memberships);
  await member(org.id, reader.id);
  const ids: string[] = [];
  let cursor: { createdAt: string; id: string; context: string } | undefined;
  const first = await directory.page(org.id, owner.id, { query: "Team " });
  for (let i = 0; i < 4; i++) {
    const page = await directory.page(org.id, owner.id, { query: "Team ", cursor });
    expect(page.owner?.id).toBe(owner.id);
    ids.push(...page.members.map((row) => row.id));
    if (!page.nextCursor) break;
    expect(page.nextCursor.createdAt).toBe(time);
    cursor = { ...page.nextCursor, context: page.context };
  }
  expect(ids).toEqual(
    [...memberships].sort((a, b) => b.id.localeCompare(a.id)).map((row) => row.userId),
  );
  expect(new Set(ids).size).toBe(43);
  if (!first.nextCursor) throw new Error("Expected another team page");
  const bound = { ...first.nextCursor, context: first.context };
  await expect(
    directory.page(org.id, reader.id, { query: "Team ", cursor: bound }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await expect(
    directory.page(other.id, owner.id, { query: "Team ", cursor: bound }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await expect(
    directory.page(org.id, owner.id, { query: "", cursor: bound }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("filters effective admin/delegated access and reflects existing role commands while preserving unrelated permissions", async () => {
  const owner = await actor(),
    org = await organization(owner.id),
    admin = await actor(),
    developer = await actor(),
    reader = await actor(),
    legacy = await actor();
  await member(org.id, admin.id, "admin");
  await member(org.id, developer.id, "developer", ["manage_servers"]);
  const target = await member(org.id, reader.id, "member", ["manage_products", "custom"]);
  await member(org.id, legacy.id, "owner", ["manage_servers"]);
  expect(
    (await directory.page(org.id, owner.id, { query: "", access: "yes" })).members
      .map((row) => row.id)
      .sort(),
  ).toEqual([admin.id, developer.id].sort());
  expect(
    (
      await directory.page(org.id, owner.id, { query: "", role: "other", access: "no" })
    ).members.map((row) => row.id),
  ).toEqual([legacy.id]);
  const saved = await management.changeMember(
    org.id,
    owner.id,
    org.updatedAt,
    reader.id,
    { role: "developer", managesServers: true },
    audit(owner.id, org.id),
  );
  expect(
    (
      await directory.page(org.id, reader.id, {
        query: reader.username,
        role: "developer",
        access: "yes",
      })
    ).members[0],
  ).toMatchObject({
    id: reader.id,
    role: "developer",
    managesServers: true,
    effectiveServerAccess: true,
  });
  const [stored] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, target.id));
  expect(stored.permissions).toEqual(
    expect.arrayContaining(["manage_products", "custom", "manage_servers"]),
  );
  await expect(
    management.changeMember(
      org.id,
      reader.id,
      saved.organization.updatedAt,
      admin.id,
      null,
      audit(reader.id, org.id),
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    management.changeMember(
      org.id,
      owner.id,
      org.updatedAt,
      reader.id,
      null,
      audit(owner.id, org.id),
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  const notice = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, reader.id));
  expect(notice.some((row) => row.message === `Organization ${org.id}: updated.`)).toBe(true);
});
it("honors current ownership and membership revocation and retains the prior directory state when a mandatory write fails", async () => {
  const owner = await actor(),
    next = await actor(),
    outsider = await actor("admin"),
    org = await organization(owner.id);
  await member(org.id, next.id);
  await member(org.id, owner.id, "owner");
  await expect(directory.page(org.id, outsider.id, { query: "" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const duplicate = audit(owner.id, org.id);
  await db.insert(auditEvents).values(duplicate);
  await expect(
    management.changeMember(
      org.id,
      owner.id,
      org.updatedAt,
      next.id,
      { role: "admin", managesServers: true },
      duplicate,
    ),
  ).rejects.toThrow();
  expect(
    (await directory.page(org.id, owner.id, { query: next.username })).members[0],
  ).toMatchObject({ role: "member", managesServers: false, effectiveServerAccess: false });
  await db.update(organizations).set({ ownerId: next.id }).where(eq(organizations.id, org.id));
  await expect(directory.page(org.id, owner.id, { query: "" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const current = await directory.page(org.id, next.id, { query: "" });
  expect(current.role).toBe("owner");
  expect(current.owner?.id).toBe(next.id);
  expect(current.members.map((row) => row.id)).not.toContain(next.id);
  await db
    .delete(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, owner.id)),
    );
  await expect(directory.page(org.id, owner.id, { query: "" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
