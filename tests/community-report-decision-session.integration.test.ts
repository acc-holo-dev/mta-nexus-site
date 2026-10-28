import { randomUUID } from "node:crypto";
import {
  db,
  discussionRevision,
  communityReportsRepository as repository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import {
  auditEvents,
  comments,
  content,
  notifications,
  reports,
  sessions,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [];
const id = () => randomUUID();
type Mode = "review" | "resolve" | "dismiss" | "remove_comment" | "discussion" | "publication";
const modes: Mode[] = [
  "review",
  "resolve",
  "dismiss",
  "remove_comment",
  "discussion",
  "publication",
];

afterEach(async () => {
  if (actors.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
});
async function actor(role = "user") {
  const userId = id();
  const row = await userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Decision fixture",
    role,
  });
  actors.push(row.id);
  return row;
}
async function session(userId: string, expiresAt = new Date(Date.now() + 60_000)) {
  const token = id();
  const row = await sessionRepository.create({ id: id(), userId, token, expiresAt });
  return { ...row, token };
}
async function fixture(mode: Mode) {
  const author = await actor(),
    reporter = await actor(),
    moderator = await actor("moderator");
  const current = await session(moderator.id),
    other = await session(moderator.id);
  const [publication] = await db
    .insert(content)
    .values({
      id: id(),
      slug: id(),
      title: "Publication",
      body: "Body",
      authorId: author.id,
      status: "published",
      type: "post",
      commentCount: 1,
    })
    .returning();
  const [comment] = await db
    .insert(comments)
    .values({ id: id(), contentId: publication.id, authorId: author.id, text: "Original" })
    .returning();
  const reportIds = [id(), ...(mode === "discussion" || mode === "publication" ? [id()] : [])];
  await db.insert(reports).values(
    reportIds.map((reportId) => ({
      id: reportId,
      reporterId: reporter.id,
      targetType: mode === "publication" ? "content" : "comment",
      targetId: mode === "publication" ? publication.id : comment.id,
      type: "abuse",
      reason: "Recorded complaint",
    })),
  );
  const auditIds = reportIds.map(id),
    removalAuditId = id();
  const input = {
    items: reportIds.map((reportId) => ({ id: reportId, expectedStatus: "open" as const })),
    action: "resolve" as const,
    notes: "Reviewed reason",
  };
  const preview =
    mode === "discussion"
      ? await repository.previewDiscussionBatch(moderator.id, publication.id, comment.id, input)
      : mode === "publication"
        ? await repository.previewPublicationBatch(moderator.id, publication.id, input)
        : null;
  const command = { ...input, previewRevision: preview?.previewRevision ?? "" };
  const decide = (token: string = current.token, ids = auditIds) =>
    mode === "discussion"
      ? repository.decideDiscussionBatch(
          moderator.id,
          publication.id,
          comment.id,
          command,
          ids,
          token,
        )
      : mode === "publication"
        ? repository.decidePublicationBatch(moderator.id, publication.id, command, ids, token)
        : repository.decide({
            id: reportIds[0],
            actorId: moderator.id,
            currentToken: token,
            expectedStatus: "open",
            action: mode,
            notes: input.notes,
            expectedRevision: discussionRevision(comment.id, comment.text),
            auditId: ids[0],
            removalAuditId,
          });
  return {
    author,
    reporter,
    moderator,
    current,
    other,
    publication,
    comment,
    reportIds,
    auditIds,
    removalAuditId,
    decide,
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function unchanged(f: Fixture) {
  const stored = await db.select().from(reports).where(inArray(reports.id, f.reportIds));
  expect(stored).toHaveLength(f.reportIds.length);
  expect(
    stored.every(
      (row) => row.status === "open" && row.moderatorNotes === null && row.resolvedAt === null,
    ),
  ).toBe(true);
  expect(await db.select().from(comments).where(eq(comments.id, f.comment.id))).toHaveLength(1);
  expect(
    (await db.select().from(content).where(eq(content.id, f.publication.id)))[0].commentCount,
  ).toBe(1);
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.moderator.id)),
  ).toHaveLength(0);
  expect(
    await db
      .select()
      .from(notifications)
      .where(inArray(notifications.recipientId, [f.reporter.id, f.author.id])),
  ).toHaveLength(0);
}

it.each(modes)(
  "rejects every invalid initiating token for %s even when another session is live",
  async (mode) => {
    const f = await fixture(mode);
    const foreign = await session(f.reporter.id),
      expired = await session(f.moderator.id, new Date(Date.now() - 1000)),
      revoked = await session(f.moderator.id);
    await db.delete(sessions).where(eq(sessions.id, revoked.id));
    for (const token of [
      "",
      id(),
      digestSessionToken(f.current.token),
      foreign.token,
      expired.token,
      revoked.token,
    ]) {
      await expect(f.decide(token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await unchanged(f);
    }
    expect(await sessionRepository.findValidSession(f.other.token)).not.toBeNull();
  },
);

it.each(modes)(
  "commits %s with a live initiating session, audit and private outcome notices",
  async (mode) => {
    const f = await fixture(mode);
    await f.decide();
    const stored = await db.select().from(reports).where(inArray(reports.id, f.reportIds));
    expect(
      stored.every(
        (row) =>
          row.status ===
          (mode === "review" ? "under_review" : mode === "dismiss" ? "dismissed" : "resolved"),
      ),
    ).toBe(true);
    const audits = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorId, f.moderator.id));
    expect(audits).toHaveLength(f.reportIds.length + (mode === "remove_comment" ? 1 : 0));
    expect(JSON.stringify(audits)).not.toContain(f.current.token);
    const notices = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.recipientId, [f.reporter.id, f.author.id]));
    expect(notices).toHaveLength(f.reportIds.length + (mode === "remove_comment" ? 1 : 0));
    expect(
      JSON.stringify(notices.filter((row) => row.recipientId === f.reporter.id)),
    ).not.toContain("Reviewed reason");
  },
);

async function waitForBlock(pid: number) {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    const rows = await db.execute(
      sql`select pid from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid))`,
    );
    if (rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Decision did not reach the expected database lock");
}
async function blocked(
  f: Fixture,
  lock: "report" | "publication" | "session" | "role",
  change: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<unknown>,
) {
  let pending: Promise<unknown> | undefined;
  try {
    await db.transaction(async (tx) => {
      const [{ pid }] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      if (lock === "report")
        await tx.select().from(reports).where(eq(reports.id, f.reportIds[0])).for("update");
      else if (lock === "publication")
        await tx.select().from(content).where(eq(content.id, f.publication.id)).for("update");
      else if (lock === "session")
        await tx.select().from(sessions).where(eq(sessions.id, f.current.id)).for("update");
      else await tx.update(users).set({ role: "user" }).where(eq(users.id, f.moderator.id));
      pending = f.decide().then(
        () => ({ success: true }),
        (error: unknown) => error,
      );
      await waitForBlock(pid);
      await change(tx);
    });
    return await pending;
  } finally {
    await pending;
  }
}

it.each(["review", "remove_comment", "discussion", "publication"] as const)(
  "rechecks the exact initiating session after %s target/report lock waits",
  async (mode) => {
    const f = await fixture(mode);
    const result = await blocked(
      f,
      mode === "discussion" || mode === "publication" ? "publication" : "report",
      async () => {
        await db.delete(sessions).where(eq(sessions.id, f.current.id));
      },
    );
    expect(result).toMatchObject({ code: "UNAUTHORIZED" });
    await unchanged(f);
    expect(await sessionRepository.findValidSession(f.other.token)).not.toBeNull();
  },
);

it.each(["review", "remove_comment", "discussion", "publication"] as const)(
  "rejects session expiry after %s waits on its locked initiating session",
  async (mode) => {
    const f = await fixture(mode);
    const result = await blocked(f, "session", async (tx) => {
      await tx
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(sessions.id, f.current.id));
    });
    expect(result).toMatchObject({ code: "UNAUTHORIZED" });
    await unchanged(f);
  },
);

it.each(["review", "remove_comment", "discussion", "publication"] as const)(
  "rejects current role revocation while %s waits for its staff row",
  async (mode) => {
    const f = await fixture(mode);
    expect(await blocked(f, "role", async () => {})).toMatchObject({ code: "FORBIDDEN" });
    await unchanged(f);
  },
);

it.each(["discussion", "publication"] as const)(
  "rolls back all %s batch reports, audit and notices on a mandatory audit failure",
  async (mode) => {
    const f = await fixture(mode),
      duplicate = id();
    await db.insert(auditEvents).values({
      id: duplicate,
      actorId: f.author.id,
      actorType: "user",
      action: "fixture",
      targetType: "report",
      targetId: f.reportIds[0],
    });
    await expect(f.decide(f.current.token, [f.auditIds[0], duplicate])).rejects.toThrow();
    await unchanged(f);
    await f.decide();
    expect(
      await db.select().from(notifications).where(eq(notifications.recipientId, f.reporter.id)),
    ).toHaveLength(2);
  },
);
