import { randomUUID } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  followWorkspaceRepository as repository,
  publicDirectoryRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { follows, notifications, organizations, servers, users } from "../packages/db/src/schema";
const actorIds: string[] = [],
  orgIds: string[] = [],
  serverIds: string[] = [];
afterEach(async () => {
  if (serverIds.length) await db.delete(servers).where(inArray(servers.id, serverIds));
  if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
  if (actorIds.length) await db.delete(users).where(inArray(users.id, actorIds));
  actorIds.length = 0;
  orgIds.length = 0;
  serverIds.length = 0;
});
async function actor(role = "user") {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await userRepository.create({
    id: `usr_follow_${suffix}`,
    username: `follow_${suffix}`,
    email: `follow_${suffix}@nexus.test`,
    displayName: `Follow ${suffix}`,
    role,
  });
  actorIds.push(user.id);
  return user;
}
it.each([true, false])(
  "rejects a revoked initiating session after waiting for the follow lock: %s",
  async (following) => {
    const follower = await actor(),
      target = await actor();
    const token = `token_${randomUUID()}`;
    await sessionRepository.create({
      id: `ses_${randomUUID()}`,
      userId: follower.id,
      token,
      expiresAt: new Date("2099-01-01"),
    });
    if (!following)
      await repository.setFollowing(follower.id, "user", target.id, true, `fol_${randomUUID()}`);
    let release!: () => void, ready!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      const key = JSON.stringify([follower.id, "user", target.id]);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      ready();
      await released;
    });
    try {
      await Promise.race([locked, blocker]);
      const result = repository
        .setFollowingAuthenticated(
          follower.id,
          "user",
          target.id,
          following,
          `fol_${randomUUID()}`,
          {},
          token,
        )
        .then(
          () => null,
          (error: unknown) => error,
        );
      const deadline = Date.now() + 3000;
      let blocked = false;
      while (Date.now() < deadline) {
        const [row] = await db.execute<{ blocked: boolean }>(
          sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
        );
        if (row?.blocked) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await sessionRepository.delete(token);
      release();
      await blocker;
      expect(await result).toMatchObject({ code: "UNAUTHORIZED" });
      const rows = await db
        .select()
        .from(follows)
        .where(and(eq(follows.followerId, follower.id), eq(follows.targetId, target.id)));
      expect(rows).toHaveLength(following ? 0 : 1);
      const notices = await db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, target.id));
      expect(notices).toHaveLength(following ? 0 : 1);
    } finally {
      release();
      await blocker.catch(() => {});
    }
  },
  15000,
);
it("serializes concurrent repeated follows into one row and one creation signal", async () => {
  const follower = await actor(),
    target = await actor();
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      repository.setFollowing(follower.id, "user", target.id, true, `fol_${randomUUID()}`),
    ),
  );
  expect(results.every((row) => row.following)).toBe(true);
  expect(results.filter((row) => row.created)).toHaveLength(1);
  const rows = await db.select().from(follows).where(eq(follows.followerId, follower.id));
  expect(rows).toHaveLength(1);
  await Promise.all(
    Array.from({ length: 4 }, () =>
      repository.setFollowing(follower.id, "user", target.id, false, "unused"),
    ),
  );
  expect(await db.select().from(follows).where(eq(follows.followerId, follower.id))).toHaveLength(
    0,
  );
});
it("keeps vanished targets removable without revealing another actor's subscriptions", async () => {
  const follower = await actor(),
    other = await actor();
  const id = `org_follow_${randomUUID()}`;
  orgIds.push(id);
  await db
    .insert(organizations)
    .values({ id, name: "Public team", slug: `follow-${randomUUID()}`, ownerId: follower.id });
  await repository.setFollowing(follower.id, "organization", id, true, `fol_${randomUUID()}`);
  expect((await repository.page(other.id)).items).toHaveLength(0);
  await db.delete(organizations).where(eq(organizations.id, id));
  const unavailable = (await repository.page(follower.id)).items[0];
  expect(unavailable).toMatchObject({
    targetId: id,
    title: null,
    handle: null,
    image: null,
    description: null,
  });
  await repository.setFollowing(follower.id, "organization", id, false, "unused");
  expect((await repository.page(follower.id)).items).toHaveLength(0);
});
it("denies a private server and hides a formerly public server after privacy changes", async () => {
  const follower = await actor();
  const id = `srv_follow_${randomUUID()}`;
  serverIds.push(id);
  await db.insert(servers).values({
    id,
    name: "Private server marker",
    slug: `follow-${randomUUID()}`,
    ipAddress: `follow-${randomUUID()}.test`,
    port: 22003,
    visibility: "private",
  });
  await expect(
    repository.setFollowing(follower.id, "server", id, true, `fol_${randomUUID()}`),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await db.update(servers).set({ visibility: "public" }).where(eq(servers.id, id));
  await repository.setFollowing(follower.id, "server", id, true, `fol_${randomUUID()}`);
  await db.update(servers).set({ visibility: "private" }).where(eq(servers.id, id));
  expect((await repository.page(follower.id)).items[0]).toMatchObject({
    title: null,
    handle: null,
    description: null,
  });
  expect(
    (await repository.page(follower.id, { query: "Private server marker" })).items,
  ).toHaveLength(0);
});
it("traverses forty-five equal-microsecond follow keys exactly once", async () => {
  const follower = await actor(),
    target = await actor();
  const ids = Array.from({ length: 45 }, () => `fol_${randomUUID()}`);
  await db.insert(follows).values(
    ids.map((id, index) => ({
      id,
      followerId: follower.id,
      targetType: "user",
      targetId: `${target.id}-${index}`,
    })),
  );
  await db
    .update(follows)
    .set({ createdAt: sql`'2026-10-10T12:00:00.123456Z'::timestamptz` })
    .where(and(eq(follows.followerId, follower.id), inArray(follows.id, ids)));
  const found: string[] = [];
  let cursor: { createdAt: string; id: string } | undefined;
  for (let page = 0; page < 4; page++) {
    const result = await repository.page(follower.id, { cursor });
    found.push(...result.items.map((item) => item.id));
    if (!result.nextCursor) break;
    expect(result.nextCursor.createdAt).toBe("2026-10-10T12:00:00.123456Z");
    cursor = result.nextCursor;
  }
  expect(found).toHaveLength(45);
  expect(new Set(found).size).toBe(45);
  expect(found).toEqual([...ids].sort().reverse());
});
it("applies creator verification and escaped search before paging", async () => {
  const developer = await actor("developer"),
    member = await actor();
  const marker = `Query_%_${randomUUID()}`;
  await db
    .update(users)
    .set({ displayName: marker, isVerified: true })
    .where(inArray(users.id, [developer.id, member.id]));
  const result = await publicDirectoryRepository.pageCreators({ query: marker, verified: true });
  expect(result.items.map((item) => item.id)).toEqual([developer.id]);
  expect(result.items[0]).not.toHaveProperty("email");
});
