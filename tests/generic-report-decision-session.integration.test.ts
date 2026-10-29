import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  reportRepository,
  reports,
  sessionRepository,
  sessions,
  userRepository,
  users,
} from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";

const actorIds: string[] = [];
afterEach(async () => {
  if (actorIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.actorId, actorIds));
    await db.delete(users).where(inArray(users.id, actorIds));
    actorIds.length = 0;
  }
});

async function fixture(role: "moderator" | "admin" = "moderator", status = "open") {
  const key = randomUUID(),
    actorId = `usr_generic_report_${key}`,
    reportId = `rpt_generic_session_${key}`,
    sessionId = `ses_generic_report_${key}`,
    token = `generic-report-token-${key}`;
  actorIds.push(actorId);
  await userRepository.create({
    id: actorId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Generic report session fixture",
    role,
  });
  await sessionRepository.create({
    id: sessionId,
    userId: actorId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  await db.insert(reports).values({
    id: reportId,
    reporterId: actorId,
    targetType: "product",
    targetId: `prd_generic_report_${key}`,
    type: "scam",
    reason: "Review the supporting evidence",
    status,
  });
  return { actorId, reportId, sessionId, token };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
function decide(f: Fixture, token = f.token, status: "resolved" | "dismissed" = "resolved") {
  return reportRepository.resolve(
    f.reportId,
    status,
    "Reviewed supporting evidence",
    {
      id: `aud_generic_report_${randomUUID()}`,
      actorId: f.actorId,
      actorType: "admin",
      action: status === "resolved" ? "admin.resolve" : "admin.dismiss",
      targetType: "report",
      targetId: f.reportId,
    },
    token,
  );
}
async function state(f: Fixture) {
  return {
    report: await db.select().from(reports).where(eq(reports.id, f.reportId)),
    audits: await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.actorId), eq(auditEvents.targetId, f.reportId))),
  };
}
function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForLock(table: "reports" | "users" | "sessions") {
  await expect
    .poll(
      async () => {
        const rows = await db.execute<{ waiting: boolean }>(sql`select exists (
          select 1 from pg_stat_activity where datname = current_database()
          and pid <> pg_backend_pid() and wait_event_type = 'Lock'
          and query like ${`%"${table}"%`}
        ) as waiting`);
        return rows[0]?.waiting === true;
      },
      { timeout: 10000, interval: 10 },
    )
    .toBe(true);
}

for (const invalid of ["revoked", "expired", "foreign", "digest", "unknown", "missing"] as const) {
  it(`rejects a ${invalid} initiating session without changing the report or audit`, async () => {
    const f = await fixture(),
      before = await state(f);
    let token = f.token;
    if (invalid === "revoked") await sessionRepository.delete(token);
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (invalid === "foreign") token = (await fixture()).token;
    if (invalid === "digest") token = createHash("sha256").update(token).digest("hex");
    if (invalid === "unknown") token = `unknown-${randomUUID()}`;
    if (invalid === "missing") token = "";
    await expect(decide(f, token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await state(f)).toEqual(before);
  });
}

for (const role of ["moderator", "admin"] as const) {
  for (const pendingStatus of ["open", "under_review"]) {
    it(`lets a current ${role} decide a ${pendingStatus} report exactly once`, async () => {
      const f = await fixture(role, pendingStatus),
        status = pendingStatus === "open" ? "resolved" : "dismissed";
      const outcomes = await Promise.all([decide(f, f.token, status), decide(f, f.token, status)]);
      expect(outcomes.filter(Boolean)).toHaveLength(1);
      const saved = await state(f);
      expect(saved.report[0]).toMatchObject({
        status,
        moderatorNotes: "Reviewed supporting evidence",
        resolvedAt: expect.any(Date),
      });
      expect(saved.audits).toHaveLength(1);
      expect(saved.audits[0]).toMatchObject({
        action: status === "resolved" ? "admin.resolve" : "admin.dismiss",
        createdAt: saved.report[0].resolvedAt,
      });
    });
  }
}

it("keeps review reports and closed reports outside generic decision writes", async () => {
  const review = await fixture(),
    closed = await fixture("admin", "dismissed");
  await db.update(reports).set({ targetType: "review" }).where(eq(reports.id, review.reportId));
  for (const f of [review, closed, { ...closed, reportId: `missing-${randomUUID()}` }]) {
    const before = await state(f);
    expect(await decide(f)).toBeNull();
    expect(await state(f)).toEqual(before);
  }
});

for (const change of ["revoked", "expired"] as const) {
  it(`rejects a decision ${change} during the report lock wait`, async () => {
    const f = await fixture(),
      before = await state(f),
      locked = deferred(),
      release = deferred(),
      expiresAt = new Date(Date.now() + 2000);
    if (change === "expired")
      await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(reports).where(eq(reports.id, f.reportId)).for("update");
      locked.resolve();
      await release.promise;
    });
    await Promise.race([locked.promise, blocker]);
    const pending = decide(f).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock("reports");
      if (change === "revoked") await sessionRepository.delete(f.token);
      if (change === "expired")
        await expect
          .poll(() => Date.now(), { timeout: 5000, interval: 10 })
          .toBeGreaterThanOrEqual(expiresAt.getTime());
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    expect(await state(f)).toEqual(before);
  }, 20000);
}

it("rechecks the current moderator role after waiting on the actor", async () => {
  const f = await fixture(),
    before = await state(f),
    locked = deferred(),
    release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx.update(users).set({ role: "user" }).where(eq(users.id, f.actorId));
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = decide(f).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock("users");
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "FORBIDDEN" } });
  expect(await state(f)).toEqual(before);
}, 20000);

it("rejects expiry after the session-row wait even when its SELECT started while valid", async () => {
  const f = await fixture(),
    before = await state(f),
    expiresAt = new Date(Date.now() + 2000),
    locked = deferred(),
    release = deferred();
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
  const blocker = db.transaction(async (tx) => {
    await tx.select().from(sessions).where(eq(sessions.id, f.sessionId)).for("update");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = decide(f).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock("sessions");
    await expect
      .poll(() => Date.now(), { timeout: 5000, interval: 10 })
      .toBeGreaterThanOrEqual(expiresAt.getTime());
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await state(f)).toEqual(before);
}, 20000);
