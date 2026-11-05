import { randomUUID } from "node:crypto";
import {
  contentRepository,
  db,
  productRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  content,
  organizationMembers,
  organizations,
  products,
  servers,
  sessions,
  users,
} from "../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitForBlocker(pid: number) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(sql`select exists (
      select 1 from pg_stat_activity where datname=current_database()
        and ${pid} = any(pg_blocking_pids(pid))
    ) as blocked`);
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Creation did not reach the locked product");
}

async function fixture() {
  const key = randomUUID().replaceAll("-", "");
  const actor = `usr_cc_actor_${key}`,
    owner = `usr_cc_owner_${key}`,
    org = `org_cc_${key}`,
    product = `prd_cc_${key}`,
    token = `tok_cc_${key}`,
    session = `ses_cc_${key}`;
  for (const id of [actor, owner])
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
    });
  await db.insert(organizations).values({ id: org, name: "Org", slug: org, ownerId: owner });
  await db.insert(organizationMembers).values({
    id: `om_cc_${key}`,
    organizationId: org,
    userId: actor,
    role: "member",
    permissions: ["manage_products"],
  });
  await db.insert(products).values({
    id: product,
    title: "Resource",
    slug: product,
    description: "Resource",
    type: "script",
    authorId: owner,
    organizationId: org,
  });
  await sessionRepository.create({
    id: session,
    userId: actor,
    token,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const create = (suffix: string, type: "post" | "article" = "post") => {
    const id = `cnt_cc_${key}_${suffix}`;
    return contentRepository.createWithAudit(
      {
        id,
        slug: id,
        title: "Title",
        body: "Publication body",
        type,
        status: "published",
        authorId: actor,
        productId: product,
        tags: [],
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      },
      {
        id: `aud_cc_${key}_${suffix}`,
        actorId: actor,
        actorType: "user",
        action: "content.created",
        targetType: "content",
        targetId: id,
      },
      token,
    );
  };
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actor));
    await db.delete(content).where(eq(content.authorId, actor));
    await db.delete(products).where(eq(products.id, product));
    await db.delete(organizations).where(eq(organizations.id, org));
    await db.delete(users).where(eq(users.id, actor));
    await db.delete(users).where(eq(users.id, owner));
  };
  return { actor, org, product, session, token, key, create, cleanup };
}

it("rejects a stale owner membership when linking a resource", async () => {
  const f = await fixture();
  try {
    await db
      .update(organizationMembers)
      .set({ role: "owner", permissions: ["manage_products"] })
      .where(eq(organizationMembers.userId, f.actor));
    await expect(f.create("stale")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.select().from(content).where(eq(content.authorId, f.actor))).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor)),
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

it("rejects product authority revoked while creation waits, without content or audit", async () => {
  const f = await fixture();
  const locked = deferred(),
    release = deferred();
  let blocker: Promise<void> | undefined;
  try {
    expect(
      await productRepository.hasManagementAccess(f.product, { id: f.actor, role: "user" }),
    ).toBe(true);
    let pid = 0;
    blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, f.product))
        .for("update");
      locked.resolve();
      await release.promise;
      await tx
        .update(organizationMembers)
        .set({ permissions: [] })
        .where(eq(organizationMembers.userId, f.actor));
    });
    await Promise.race([locked.promise, blocker]);
    const pending = f.create("revoked").then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitForBlocker(pid);
    } finally {
      release.resolve();
    }
    await blocker;
    expect(await pending).toMatchObject({ code: "NOT_FOUND" });
    expect(await db.select().from(content).where(eq(content.authorId, f.actor))).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor)),
    ).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker?.catch(() => {});
    await f.cleanup();
  }
});

it("requires live moderator authority for editorial publication and a live initiating session", async () => {
  const f = await fixture();
  try {
    await expect(f.create("denied", "article")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(users).set({ role: "moderator" }).where(eq(users.id, f.actor));
    await expect(f.create("allowed", "article")).resolves.toMatchObject({ status: "published" });
    await db.delete(sessions).where(eq(sessions.id, f.session));
    await expect(f.create("revoked-session")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await db.select().from(content).where(eq(content.authorId, f.actor))).toHaveLength(1);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor)),
    ).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});

it("rejects an initiating session revoked while creation waits", async () => {
  const f = await fixture();
  const locked = deferred(),
    release = deferred();
  let blocker: Promise<void> | undefined;
  try {
    let pid = 0;
    blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, f.product))
        .for("update");
      locked.resolve();
      await release.promise;
      await tx.delete(sessions).where(eq(sessions.id, f.session));
    });
    await Promise.race([locked.promise, blocker]);
    const pending = f.create("session-race").then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitForBlocker(pid);
    } finally {
      release.resolve();
    }
    await blocker;
    expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
    expect(await db.select().from(content).where(eq(content.authorId, f.actor))).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor)),
    ).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker?.catch(() => {});
    await f.cleanup();
  }
});

it("preserves valid combinations of resource, server and organization sources", async () => {
  const f = await fixture();
  const serverId = `srv_cc_${f.key}`,
    orgId = `org_cc_extra_${f.key}`,
    contentId = `cnt_cc_combo_${f.key}`;
  try {
    await db.insert(servers).values({
      id: serverId,
      name: "Server",
      slug: serverId,
      ipAddress: `${f.key}.example.invalid`,
      ownerId: f.actor,
    });
    await db
      .insert(organizations)
      .values({ id: orgId, name: "Other org", slug: orgId, ownerId: f.actor });
    const saved = await contentRepository.createWithAudit(
      {
        id: contentId,
        slug: contentId,
        title: "Title",
        body: "Publication body",
        type: "post",
        status: "published",
        authorId: f.actor,
        serverId,
        productId: f.product,
        organizationId: orgId,
        tags: [],
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      },
      {
        id: `aud_cc_combo_${f.key}`,
        actorId: f.actor,
        actorType: "user",
        action: "content.created",
        targetType: "content",
        targetId: contentId,
      },
      f.token,
    );
    expect(saved).toMatchObject({ serverId, productId: f.product, organizationId: orgId });
  } finally {
    await db.delete(content).where(eq(content.id, contentId));
    await db.delete(servers).where(eq(servers.id, serverId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await f.cleanup();
  }
});
