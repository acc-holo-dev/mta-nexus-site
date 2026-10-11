import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db, publicationFeedRepository as feed, userRepository } from "@nexus/db";
import { content, servers, userProfilePreferences, users } from "../packages/db/src/schema";
import { publicationFeedService as service } from "../apps/web/src/lib/services/publication-feed-service";
import {
  parsePublicationQuery,
  publicationPageQuery,
} from "../apps/web/src/lib/publication-feed-contract";
const actorIds: string[] = [],
  serverIds: string[] = [];
afterEach(async () => {
  if (serverIds.length) {
    await db.delete(content).where(inArray(content.serverId, serverIds));
    await db.delete(servers).where(inArray(servers.id, serverIds));
  }
  if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
  actorIds.length = 0;
  serverIds.length = 0;
});
async function actor() {
  const suffix = randomUUID().replaceAll("-", "");
  const row = await userRepository.create({
    id: `usr_archive_${suffix}`,
    email: `${suffix}@nexus.test`,
    username: `archive_${suffix}`,
    displayName: "Archive writer",
  });
  actorIds.push(row.id);
  return row;
}
async function server() {
  const suffix = randomUUID();
  const id = `srv_archive_${suffix}`;
  serverIds.push(id);
  const [row] = await db
    .insert(servers)
    .values({
      id,
      name: "Public MTA",
      slug: `archive-${suffix}`,
      ipAddress: `${suffix}.test`,
      port: 22003,
      visibility: "public",
      status: "active",
    })
    .returning();
  return row;
}
async function publication(authorId: string, serverId: string, extra = {}) {
  const [row] = await db
    .insert(content)
    .values({
      id: `cnt_archive_${randomUUID()}`,
      slug: `archive-${randomUUID()}`,
      authorId,
      serverId,
      title: "Public update",
      body: "Body",
      type: "news",
      status: "published",
      ...extra,
    })
    .returning();
  return row;
}
function query(cursor: string, extra: Record<string, string> = {}) {
  const parsed = parsePublicationQuery(new URLSearchParams({ cursor, ...extra }), false, true);
  if (!parsed) throw new Error("Invalid fixture cursor");
  return parsed;
}
it("traverses forty-five same-microsecond server publications in both directions without duplicates", async () => {
  const writer = await actor(),
    target = await server();
  const stored = await Promise.all(
    Array.from({ length: 45 }, () => publication(writer.id, target.id)),
  );
  await db
    .update(content)
    .set({ publishedAt: sql`'2026-10-11T00:00:00.123456Z'::timestamptz` })
    .where(eq(content.serverId, target.id));
  const scope = { kind: "server" as const, id: target.id };
  const first = await service.page(scope, publicationPageQuery());
  const second = await service.page(scope, query(first.nextCursor ?? ""));
  const third = await service.page(scope, query(second.nextCursor ?? ""));
  expect([...first.items, ...second.items, ...third.items].map((row) => row.id)).toEqual(
    stored
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
  expect(first.previousCursor).toBeNull();
  expect(third.hasMore).toBe(false);
  expect(JSON.parse(second.previousCursor ?? "").createdAt).toBe("2026-10-11T00:00:00.123456Z");
  const backSecond = await service.page(scope, query(third.previousCursor ?? ""));
  const backFirst = await service.page(scope, query(backSecond.previousCursor ?? ""));
  expect(backSecond.items.map((row) => row.id)).toEqual(second.items.map((row) => row.id));
  expect(backFirst.items.map((row) => row.id)).toEqual(first.items.map((row) => row.id));
  expect(backFirst.previousCursor).toBeNull();
});
it("applies literal text, exact author and case-insensitive tag filters before limiting results", async () => {
  const writer = await actor(),
    other = await actor(),
    target = await server();
  const matched = await publication(writer.id, target.id, {
    title: "Literal %_ match",
    tags: ["MTA", "Lua"],
  });
  await Promise.all(
    Array.from({ length: 30 }, () =>
      publication(other.id, target.id, { title: "Literal other match", tags: ["MTA"] }),
    ),
  );
  await publication(writer.id, target.id, {
    title: "Literal %_ draft",
    tags: ["MTA"],
    status: "draft",
  });
  await publication(writer.id, target.id, {
    title: "Literal %_ community",
    tags: ["MTA"],
    type: "post",
  });
  const page = await feed.page(
    { kind: "server", id: target.id },
    { query: "%_", author: writer.username.toUpperCase(), tag: "mta" },
  );
  expect(page.items.map((row) => row.id)).toEqual([matched.id]);
  expect(page.hasMore).toBe(false);
  expect(page.items[0].tags).toEqual(["MTA", "Lua"]);
  expect(
    (await feed.page({ kind: "server", id: target.id }, { query: writer.username })).items.map(
      (row) => row.id,
    ),
  ).toEqual([matched.id]);
});
it("rechecks public availability when a server is made private, suspended or deleted", async () => {
  const writer = await actor(),
    target = await server();
  await publication(writer.id, target.id);
  expect(await feed.resolvePublicScope("server", target.slug)).toMatchObject({ id: target.id });
  for (const fields of [
    { visibility: "private", status: "active" },
    { visibility: "public", status: "suspended" },
  ]) {
    await db.update(servers).set(fields).where(eq(servers.id, target.id));
    expect(await feed.resolvePublicScope("server", target.slug)).toBeNull();
    expect((await feed.page({ kind: "server", id: target.id })).items).toHaveLength(0);
  }
  await db.delete(content).where(eq(content.serverId, target.id));
  await db.delete(servers).where(eq(servers.id, target.id));
  expect(await feed.resolvePublicScope("server", target.slug)).toBeNull();
});
it("honors author activity privacy while retaining public server context and narrow DTOs", async () => {
  const writer = await actor(),
    target = await server();
  await db
    .insert(userProfilePreferences)
    .values({ userId: writer.id, showActivity: false, showProfessionalContacts: false });
  await publication(writer.id, target.id, {
    tags: Array.from({ length: 15 }, (_, index) => `tag-${index}`),
  });
  expect(await feed.resolvePublicScope("user", writer.username)).toBeNull();
  expect((await feed.page({ kind: "user", id: writer.id })).items).toHaveLength(0);
  const page = await service.page({ kind: "server", id: target.id }, publicationPageQuery());
  expect(page.items).toHaveLength(1);
  expect(page.items[0].tags).toHaveLength(10);
  expect(page.items[0].author).toEqual({
    username: writer.username,
    name: writer.displayName,
    avatar: null,
  });
  expect(JSON.stringify(page)).not.toContain(writer.email);
  for (const field of ["ownerId", "ipAddress", "authorId", "body", "status"])
    expect(page.items[0]).not.toHaveProperty(field);
});
it("rejects a cursor replay against another server or filter before returning publications", async () => {
  const writer = await actor(),
    target = await server(),
    other = await server();
  await Promise.all(Array.from({ length: 21 }, () => publication(writer.id, target.id)));
  await publication(writer.id, other.id, { title: "Other context" });
  const first = await service.page({ kind: "server", id: target.id }, publicationPageQuery());
  await expect(
    service.page({ kind: "server", id: other.id }, query(first.nextCursor ?? "")),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  await expect(
    service.page({ kind: "server", id: target.id }, query(first.nextCursor ?? "", { tag: "new" })),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
