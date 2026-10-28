import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  commercialPlanReviews,
  commercialPlans,
  db,
  organizationMembers,
  organizations,
  commercialPlanRepository as plans,
  planReviewsRepository as reviews,
  sessionRepository,
  sessions,
  userRepository,
  users,
} from "@nexus/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import type { ResourceTransaction } from "../packages/db/src/transaction";

const createdUserIds = new Set<string>(),
  createdOrganizationIds = new Set<string>();

afterEach(async () => {
  const userIds = [...createdUserIds],
    organizationIds = [...createdOrganizationIds];
  await db.transaction(async (tx) => {
    if (userIds.length) {
      await tx.delete(auditEvents).where(inArray(auditEvents.actorId, userIds));
      await tx.delete(sessions).where(inArray(sessions.userId, userIds));
    }
    if (organizationIds.length) {
      await tx
        .delete(organizationMembers)
        .where(inArray(organizationMembers.organizationId, organizationIds));
      await tx.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
    if (userIds.length) await tx.delete(users).where(inArray(users.id, userIds));
    // Immutable reviews/revisions and their plans remain until the disposable DB is dropped.
  });
  createdUserIds.clear();
  createdOrganizationIds.clear();
});

async function identity(role: "user" | "admin" = "user") {
  const key = randomUUID().replaceAll("-", ""),
    actorId = `usr_prev_session_${key}`,
    token = `review-session-token-${key}`,
    sessionId = `ses_prev_session_${key}`;
  createdUserIds.add(actorId);
  await userRepository.create({
    id: actorId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Review session fixture",
    role,
  });
  await sessionRepository.create({
    id: sessionId,
    userId: actorId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { actorId, token, sessionId, key };
}

async function fixture() {
  const actor = await identity(),
    admin = await identity("admin"),
    planId = `cplan_prev_session_${actor.key}`,
    organizationId = `org_prev_session_${actor.key}`;
  createdOrganizationIds.add(organizationId);
  await db.insert(organizations).values({
    id: organizationId,
    ownerId: admin.actorId,
    name: "Review session fixture",
    slug: `review-session-${actor.key}`,
  });
  await db.insert(organizationMembers).values({
    id: `mem_prev_session_${actor.key}`,
    organizationId,
    userId: actor.actorId,
    role: "admin",
  });
  const authorization = { actorId: admin.actorId, currentToken: admin.token, planId };
  await plans.command({
    ...authorization,
    auditId: `aud_prev_session_create_${actor.key}`,
    command: {
      action: "create",
      slug: `review-session-${actor.key}`,
      scope: "organization",
      terms: {
        titleRu: "Тариф проверки",
        titleEn: "Review session fixture",
        descriptionRu: "Условия тестового тарифа",
        descriptionEn: "Session verification fixture terms",
        price: 900,
        currency: "USD",
        durationDays: 30,
        commissionBps: 750,
      },
      reason: "Create session fixture",
    },
  });
  await plans.command({
    ...authorization,
    auditId: `aud_prev_session_publish_${actor.key}`,
    command: { action: "publish", expectedRevision: 1, reason: "Publish session fixture" },
  });
  return {
    ...actor,
    planId,
    command: {
      requestId: randomUUID(),
      planId,
      organizationId,
      expectedRevision: 2,
      grossAmount: 10000,
      currency: "RUB" as const,
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;

async function state(f: Fixture) {
  const saved = await db
    .select()
    .from(commercialPlanReviews)
    .where(eq(commercialPlanReviews.actorId, f.actorId))
    .orderBy(asc(commercialPlanReviews.id));
  const audits = await db
    .select()
    .from(auditEvents)
    .where(
      and(eq(auditEvents.actorId, f.actorId), eq(auditEvents.action, "commerce.plan_review_saved")),
    )
    .orderBy(asc(auditEvents.id));
  return { saved, audits };
}

for (const invalid of ["revoked", "expired", "foreign", "digest", "unknown", "missing"] as const) {
  it(`rejects new saves and exact replays with a ${invalid} initiating session`, async () => {
    const f = await fixture();
    await reviews.save(f.actorId, f.command, f.token);
    const before = await state(f);
    let token = f.token;
    if (invalid === "revoked") await sessionRepository.delete(token);
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (invalid === "foreign") token = (await identity()).token;
    if (invalid === "digest") token = createHash("sha256").update(token).digest("hex");
    if (invalid === "unknown") token = `unknown-${randomUUID()}`;
    if (invalid === "missing") token = "";
    for (const command of [f.command, { ...f.command, requestId: randomUUID() }])
      await expect(reviews.save(f.actorId, command, token)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    expect(await state(f)).toEqual(before);
  });
}

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForLock(fragment: string) {
  await expect
    .poll(
      async () => {
        const rows = await db.execute<{ waiting: boolean }>(sql`select exists (
          select 1 from pg_stat_activity where datname = current_database()
          and pid <> pg_backend_pid() and wait_event_type = 'Lock'
          and query like ${`%${fragment}%`}
        ) as waiting`);
        return rows[0]?.waiting === true;
      },
      { timeout: 10000, interval: 10 },
    )
    .toBe(true);
}

async function lock(tx: ResourceTransaction, f: Fixture, target: string) {
  if (target === "request" || target === "account") {
    const key =
      target === "request"
        ? `plan-review:${f.actorId}:${f.command.requestId}`
        : `plan-review-account:organization:${f.command.organizationId}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  } else if (target === "plan")
    await tx.select().from(commercialPlans).where(eq(commercialPlans.id, f.planId)).for("update");
  else if (target === "organization")
    await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, f.command.organizationId))
      .for("update");
  else if (target === "actor")
    await tx.select().from(users).where(eq(users.id, f.actorId)).for("update");
  else if (target === "membership")
    await tx
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, f.command.organizationId),
          eq(organizationMembers.userId, f.actorId),
        ),
      )
      .for("update");
  else if (target === "session")
    await tx.select().from(sessions).where(eq(sessions.id, f.sessionId)).for("update");
  else throw new Error(`Unknown fixture lock: ${target}`);
}
const waits = [
  { target: "request", fragment: "pg_advisory_xact_lock", replay: true },
  { target: "account", fragment: "pg_advisory_xact_lock", replay: false },
  { target: "plan", fragment: '"commercial_plans"', replay: false },
  { target: "organization", fragment: '"organizations"', replay: true },
  { target: "actor", fragment: '"users"', replay: true },
  { target: "membership", fragment: '"organization_members"', replay: true },
];
for (const { target, fragment, replay } of waits) {
  for (const existing of replay ? [false, true] : [false]) {
    it(`rejects ${existing ? "an exact replay" : "a new save"} revoked during the ${target} lock wait`, async () => {
      const f = await fixture();
      if (existing) await reviews.save(f.actorId, f.command, f.token);
      const before = await state(f),
        locked = deferred(),
        release = deferred();
      const blocker = db.transaction(async (tx) => {
        await lock(tx, f, target);
        locked.resolve();
        await release.promise;
      });
      await Promise.race([locked.promise, blocker]);
      const pending = reviews.save(f.actorId, f.command, f.token).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      try {
        await waitForLock(fragment);
        await sessionRepository.delete(f.token);
      } finally {
        release.resolve();
        await blocker;
      }
      expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
      expect(await state(f)).toEqual(before);
    }, 20000);
  }
}

for (const existing of [false, true]) {
  it(`rechecks current membership after ${existing ? "an exact replay" : "a new save"} waits`, async () => {
    const f = await fixture();
    if (existing) await reviews.save(f.actorId, f.command, f.token);
    const before = await state(f),
      locked = deferred(),
      release = deferred();
    const blocker = db.transaction(async (tx) => {
      await tx
        .update(organizationMembers)
        .set({ role: "developer" })
        .where(
          and(
            eq(organizationMembers.organizationId, f.command.organizationId),
            eq(organizationMembers.userId, f.actorId),
          ),
        );
      locked.resolve();
      await release.promise;
    });
    await Promise.race([locked.promise, blocker]);
    const pending = reviews.save(f.actorId, f.command, f.token).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock('"organization_members"');
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { statusCode: 404 } });
    expect(await state(f)).toEqual(before);
  }, 20000);
}

it("rejects expiry after the session-row wait even if its SELECT started while valid", async () => {
  const f = await fixture(),
    before = await state(f),
    expiresAt = new Date(Date.now() + 2000),
    locked = deferred(),
    release = deferred();
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
  const blocker = db.transaction(async (tx) => {
    await lock(tx, f, "session");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = reviews.save(f.actorId, f.command, f.token).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock('"sessions"');
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
