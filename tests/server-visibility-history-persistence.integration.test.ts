import { randomUUID } from "node:crypto";
import { auditRepository, db, serverRepository, userRepository } from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  auditEvents,
  organizationMembers,
  organizations,
  servers,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [],
  teams: string[] = [],
  listings: string[] = [];
const id = (prefix: string) => `${prefix}_visibility_${randomUUID()}`;
afterEach(async () => {
  if (actors.length) await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
  if (listings.length) await db.delete(servers).where(inArray(servers.id, listings));
  if (teams.length) await db.delete(organizations).where(inArray(organizations.id, teams));
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  teams.length = 0;
  listings.length = 0;
});
async function user(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const value = await userRepository.create({
    id: id("usr"),
    username: `visibility_${suffix}`,
    email: `${suffix}@nexus.test`,
    displayName: "Server manager",
    role,
  });
  actors.push(value.id);
  return value;
}
async function fixture() {
  const manager = await user(),
    owner = await user(),
    admin = await user("admin");
  const [team] = await db
    .insert(organizations)
    .values({ id: id("org"), slug: id("team"), name: "Team", ownerId: owner.id })
    .returning();
  teams.push(team.id);
  const [grant] = await db
    .insert(organizationMembers)
    .values({
      id: id("member"),
      organizationId: team.id,
      userId: manager.id,
      role: "developer",
      permissions: ["manage_servers", "manage_products"],
    })
    .returning();
  async function server(organizationId: string | null = null, visibility = "public") {
    const [value] = await db
      .insert(servers)
      .values({
        id: id("srv"),
        slug: id("server"),
        name: "Server",
        ipAddress: "203.0.113.82",
        port: 22003 + listings.length,
        ownerId: organizationId ? null : manager.id,
        organizationId,
        visibility,
        status: organizationId ? "active" : "maintenance",
        endpointRevision: 3,
        isVerified: true,
        currentPlayers: 9,
        lastObservedAt: new Date(),
        observationSource: "official",
      })
      .returning();
    listings.push(value.id);
    return value;
  }
  const personal = await server(),
    teamServer = await server(team.id),
    untouched = await server();
  return { manager, owner, admin, team, grant, personal, teamServer, untouched, server };
}
const selected = (f: Awaited<ReturnType<typeof fixture>>) => ({
  serverIds: [f.personal.id, f.teamServer.id],
  visibility: "private" as const,
});
const audit = (f: Awaited<ReturnType<typeof fixture>>, targetId = f.personal.id) => ({
  id: id("aud"),
  actorId: f.manager.id,
  actorType: "user" as const,
  action: "fixture.seed",
  targetType: "server",
  targetId,
});
it("atomically changes selected personal and delegated listings, retains telemetry and records each actual edit", async () => {
  const f = await fixture(),
    input = selected(f),
    preview = await serverRepository.previewVisibilityBatch(f.manager.id, input);
  await serverRepository.applyVisibilityBatch(
    f.manager.id,
    { ...input, previewRevision: preview.previewRevision },
    [id("aud"), id("aud")],
  );
  const stored = await db.select().from(servers).where(inArray(servers.id, input.serverIds));
  expect(
    stored.every(
      (row) =>
        row.visibility === "private" &&
        row.endpointRevision === 3 &&
        row.isVerified &&
        row.currentPlayers === 9 &&
        row.observationSource === "official",
    ),
  ).toBe(true);
  expect(stored.find((row) => row.id === f.personal.id)).toMatchObject({
    status: "maintenance",
    ownerId: f.manager.id,
    organizationId: null,
    ipAddress: "203.0.113.82",
    port: f.personal.port,
  });
  expect(
    (await db.select().from(servers).where(eq(servers.id, f.untouched.id)))[0].visibility,
  ).toBe("public");
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.manager.id), eq(auditEvents.action, "server.updated"))),
  ).toHaveLength(2);
  expect(
    (await db.select().from(organizationMembers).where(eq(organizationMembers.id, f.grant.id)))[0]
      .permissions,
  ).toEqual(["manage_servers", "manage_products"]);
});
it("leaves matching rows and their precise revisions intact and tolerates independent telemetry refreshes", async () => {
  const f = await fixture(),
    input = selected(f);
  await db.update(servers).set({ visibility: "private" }).where(eq(servers.id, f.personal.id));
  const preview = await serverRepository.previewVisibilityBatch(f.manager.id, input),
    prior = preview.items.find((row) => row.id === f.personal.id)?.revision;
  await db.update(servers).set({ currentPlayers: 12 }).where(eq(servers.id, f.teamServer.id));
  const saved = await serverRepository.applyVisibilityBatch(
    f.manager.id,
    { ...input, previewRevision: preview.previewRevision },
    [id("aud"), id("aud")],
  );
  expect(saved.items.find((row) => row.id === f.personal.id)).toMatchObject({
    changed: false,
    revision: prior,
  });
  expect(
    (await db.select().from(servers).where(eq(servers.id, f.teamServer.id)))[0].currentPlayers,
  ).toBe(12);
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.manager.id), eq(auditEvents.action, "server.updated"))),
  ).toHaveLength(1);
});
it("allows only one concurrent confirmation and rejects intervening metadata changes", async () => {
  const f = await fixture(),
    input = selected(f),
    preview = await serverRepository.previewVisibilityBatch(f.manager.id, input);
  await db.update(servers).set({ name: "Changed listing" }).where(eq(servers.id, f.personal.id));
  await expect(
    serverRepository.applyVisibilityBatch(
      f.manager.id,
      { ...input, previewRevision: preview.previewRevision },
      [id("aud"), id("aud")],
    ),
  ).rejects.toMatchObject({ code: "SERVER_BATCH_CHANGED" });
  const fresh = await serverRepository.previewVisibilityBatch(f.manager.id, input),
    results = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        serverRepository.applyVisibilityBatch(
          f.manager.id,
          { ...input, previewRevision: fresh.previewRevision },
          [id("aud"), id("aud")],
        ),
      ),
    );
  expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
  expect(results.find((row) => row.status === "rejected")).toMatchObject({
    reason: { code: "SERVER_BATCH_CHANGED" },
  });
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.manager.id), eq(auditEvents.action, "server.updated"))),
  ).toHaveLength(2);
});
it("revoked grants and stale administrator sessions cannot mutate or read private history", async () => {
  const f = await fixture(),
    input = selected(f),
    preview = await serverRepository.previewVisibilityBatch(f.manager.id, input);
  await db
    .update(organizationMembers)
    .set({ permissions: [] })
    .where(eq(organizationMembers.id, f.grant.id));
  await expect(
    serverRepository.applyVisibilityBatch(
      f.manager.id,
      { ...input, previewRevision: preview.previewRevision },
      [id("aud"), id("aud")],
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    auditRepository.managedServerHistory(f.teamServer.id, f.manager.id, {
      period: "all",
      action: "all",
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.admin.id));
  await expect(
    serverRepository.updateManagedWithAudit(
      f.personal.id,
      { visibility: "private" },
      { ...audit(f), actorId: f.admin.id, action: "server.updated" },
      { id: f.admin.id, role: "admin" },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(
    await auditRepository.pageForManagedServer(f.personal.id, { id: f.admin.id, role: "admin" }),
  ).toBeNull();
  expect((await db.select().from(servers).where(eq(servers.id, f.personal.id)))[0].visibility).toBe(
    "public",
  );
});
it("rolls back every listing and revision when any mandatory audit insert fails", async () => {
  const f = await fixture(),
    input = selected(f),
    preview = await serverRepository.previewVisibilityBatch(f.manager.id, input),
    existing = audit(f);
  await db.insert(auditEvents).values(existing);
  await expect(
    serverRepository.applyVisibilityBatch(
      f.manager.id,
      { ...input, previewRevision: preview.previewRevision },
      [id("aud"), existing.id],
    ),
  ).rejects.toThrow();
  expect((await serverRepository.previewVisibilityBatch(f.manager.id, input)).previewRevision).toBe(
    preview.previewRevision,
  );
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.manager.id), eq(auditEvents.action, "server.updated"))),
  ).toHaveLength(0);
});
it("traverses tied microsecond events without duplicates, holds the cutoff and masks arbitrary audit details", async () => {
  const f = await fixture();
  await db.insert(auditEvents).values(
    Array.from({ length: 35 }, (_, i) => ({
      ...audit(f),
      action: "server.updated",
      details: {
        fields: ["visibility", "passwordHash"],
        previousVisibility: "public",
        visibility: "private",
        token: "sensitive detail",
      },
      ipAddress: "192.0.2.44",
      userAgent: "sensitive agent",
      createdAt: sql`date_trunc('second',current_timestamp)-interval '1 hour'+(${i} * interval '1 microsecond')`,
    })),
  );
  const filters = { period: "7" as const, action: "visibility" as const },
    first = await auditRepository.managedServerHistory(f.personal.id, f.manager.id, filters);
  expect(first.events).toHaveLength(20);
  expect(first.nextCursor).not.toBeNull();
  await db.insert(auditEvents).values({
    ...audit(f),
    action: "server.updated",
    details: { fields: ["visibility"] },
    createdAt: sql`${first.until}::timestamptz+interval '1 microsecond'`,
  });
  const second = await auditRepository.managedServerHistory(f.personal.id, f.manager.id, {
    ...filters,
    cursor: first.nextCursor ?? undefined,
  });
  expect(second.until).toBe(first.until);
  expect(second.events).toHaveLength(15);
  expect(new Set([...first.events, ...second.events].map((row) => row.id)).size).toBe(35);
  for (const event of [...first.events, ...second.events])
    expect(event.fields).toEqual(["visibility"]);
  expect(JSON.stringify(first)).not.toMatch(
    /sensitive detail|sensitive agent|192\.0\.2\.44|passwordHash/u,
  );
  expect(second.nextCursor).toBeNull();
});
