import { randomUUID } from "node:crypto";
import { db, reportRepository, sessionRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  builds,
  comments,
  content,
  products,
  reportNotificationDeliveries,
  reports,
  servers,
  users,
} from "../../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitBlocked(pid: number) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(
      sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
    );
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Report did not block on target");
}

it("enforces public targets and serializes publication changes with report creation", async () => {
  const key = randomUUID().replaceAll("-", "");
  const actor = `usr_ra_${key}`,
    author = `usr_rt_${key}`,
    token = `tok_${key}`;
  const article = `cnt_${key}`,
    comment = `cmt_${key}`,
    product = `prd_${key}`,
    build = `bld_${key}`,
    review = `cmt_rev_${key}`,
    server = `srv_${key}`;
  for (const id of [actor, author])
    await db
      .insert(users)
      .values({ id, username: id, email: `${id}@example.invalid`, displayName: id });
  await sessionRepository.create({
    id: `ses_${key}`,
    userId: actor,
    token,
    expiresAt: new Date("2099-01-01"),
  });
  await db.insert(content).values({
    id: article,
    slug: article,
    authorId: author,
    title: "Article",
    body: "Body",
    status: "published",
  });
  await db
    .insert(comments)
    .values({ id: comment, contentId: article, authorId: author, text: "Comment" });
  await db.insert(products).values({
    id: product,
    slug: product,
    authorId: author,
    title: "Product",
    description: "Description",
    type: "script",
    status: "published",
    price: 0,
  });
  await db.insert(builds).values({
    id: build,
    productId: product,
    version: "1.0.0",
    status: "published",
    storageKey: `test/${build}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 10,
    scanStatus: "clean",
    scanner: "test",
    scannedAt: new Date(),
  });
  await db
    .insert(comments)
    .values({ id: review, productId: product, authorId: author, text: "Review", rating: 5 });
  await db.insert(servers).values({
    id: server,
    slug: server,
    name: "Server",
    ipAddress: `fixture-${key}`,
    visibility: "unlisted",
    status: "suspended",
  });
  const ids: string[] = [];
  const create = (
    targetType: "content" | "comment" | "product" | "server" | "user",
    targetId: string,
  ) => {
    const id = `rpt_${randomUUID().replaceAll("-", "")}`;
    ids.push(id);
    return reportRepository.createWithAudit(
      {
        id,
        reporterId: actor,
        targetType,
        targetId,
        type: "abuse",
        reason: "Reason",
        evidenceUrls: [],
        status: "open",
      },
      {
        id: `aud_${id}`,
        actorId: actor,
        actorType: "user",
        action: "report.created",
        targetType: "report",
        targetId: id,
      },
      token,
    );
  };
  try {
    for (const [type, id] of [
      ["content", article],
      ["comment", comment],
      ["product", product],
      ["server", server],
      ["user", author],
    ] as const) {
      expect((await create(type, id)).created).toBe(true);
      expect((await create(type, id)).created).toBe(false);
    }
    await expect(create("comment", review)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const rejectedReviewId = ids.at(-1);
    if (!rejectedReviewId) throw new Error("Missing rejected review report ID");
    expect(await db.select().from(reports).where(eq(reports.id, rejectedReviewId))).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.targetId, rejectedReviewId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(reportNotificationDeliveries)
        .where(eq(reportNotificationDeliveries.reportId, rejectedReviewId)),
    ).toHaveLength(0);
    await db.update(content).set({ authorId: actor }).where(eq(content.id, article));
    await expect(create("content", article)).rejects.toMatchObject({
      code: "REPORT_OWN_TARGET",
      statusCode: 422,
    });
    // Reporting another author's comment on one's own publication is allowed.
    expect((await create("comment", comment)).created).toBe(false);
    await db.update(comments).set({ authorId: actor }).where(eq(comments.id, comment));
    await expect(create("comment", comment)).rejects.toMatchObject({
      code: "REPORT_OWN_TARGET",
      statusCode: 422,
    });
    await db.update(content).set({ authorId: author }).where(eq(content.id, article));
    await db.update(comments).set({ authorId: author }).where(eq(comments.id, comment));
    await db.update(builds).set({ status: "retired" }).where(eq(builds.id, build));
    await expect(create("product", product)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.update(products).set({ price: 100 }).where(eq(products.id, product));
    expect((await create("product", product)).created).toBe(false);
    await db.update(servers).set({ visibility: "private" }).where(eq(servers.id, server));
    await expect(create("server", server)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx.select().from(content).where(eq(content.id, article)).for("update");
      locked.resolve();
      await release.promise;
      await tx.update(content).set({ status: "draft" }).where(eq(content.id, article));
    });
    try {
      await Promise.race([locked.promise, blocker]);
      const pending = create("comment", comment).then(
        () => null,
        (error: unknown) => error,
      );
      const failedId = ids.at(-1);
      if (!failedId) throw new Error("Missing pending report ID");
      try {
        await waitBlocked(pid);
      } finally {
        release.resolve();
      }
      await blocker;
      expect(await pending).toMatchObject({ code: "NOT_FOUND" });
      await expect(create("content", article)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await db.select().from(reports).where(eq(reports.id, failedId))).toHaveLength(0);
      expect(
        await db.select().from(auditEvents).where(eq(auditEvents.targetId, failedId)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(reportNotificationDeliveries)
          .where(eq(reportNotificationDeliveries.reportId, failedId)),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker.catch(() => {});
    }
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actor));
    for (const id of ids) await db.delete(reports).where(eq(reports.id, id));
    await db.delete(servers).where(eq(servers.id, server));
    await db.delete(content).where(eq(content.id, article));
    await db.delete(products).where(eq(products.id, product));
    await db.delete(users).where(eq(users.id, actor));
    await db.delete(users).where(eq(users.id, author));
  }
}, 15000);
