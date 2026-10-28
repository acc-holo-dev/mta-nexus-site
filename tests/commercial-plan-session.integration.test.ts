import { randomUUID } from "node:crypto";
import {
  auditEvents,
  commercialPlanRevisions,
  commercialPlans,
  db,
  commercialPlanRepository as plans,
  sessionRepository,
  sessions,
  userRepository,
} from "@nexus/db";
import { count, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

const terms = {
  titleRu: "Тариф проверки",
  titleEn: "Session fixture plan",
  descriptionRu: "Условия тестового тарифа",
  descriptionEn: "Session verification fixture terms",
  price: 999,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};
async function identity() {
  const key = randomUUID().replaceAll("-", "");
  const actorId = `usr_plan_session_${key}`;
  const token = `plan-token-${key}`;
  const sessionId = `ses_plan_${key}`;
  await userRepository.create({
    id: actorId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Session fixture",
    role: "admin",
  });
  await sessionRepository.create({
    id: sessionId,
    userId: actorId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { actorId, token, sessionId, planId: `cplan_session_${key}`, key };
}
function create(f: Awaited<ReturnType<typeof identity>>, currentToken = f.token) {
  return {
    actorId: f.actorId,
    currentToken,
    planId: f.planId,
    auditId: `aud_plan_create_${f.key}`,
    command: {
      action: "create" as const,
      slug: `session-${f.key}`,
      scope: "user" as const,
      terms,
      reason: "Session fixture creation",
    },
  };
}
function publish(f: Awaited<ReturnType<typeof identity>>) {
  return {
    actorId: f.actorId,
    currentToken: f.token,
    planId: f.planId,
    auditId: `aud_plan_publish_${f.key}`,
    command: {
      action: "publish" as const,
      expectedRevision: 1,
      reason: "Session fixture publication",
    },
  };
}
async function expectUnchanged(f: Awaited<ReturnType<typeof identity>>) {
  const [plan] = await db
    .select({ status: commercialPlans.status, revision: commercialPlans.revision })
    .from(commercialPlans)
    .where(eq(commercialPlans.id, f.planId));
  expect(plan).toEqual({ status: "draft", revision: 1 });
  const [versions] = await db
    .select({ total: count() })
    .from(commercialPlanRevisions)
    .where(eq(commercialPlanRevisions.planId, f.planId));
  const [audit] = await db
    .select({ total: count() })
    .from(auditEvents)
    .where(eq(auditEvents.id, publish(f).auditId));
  expect(versions?.total).toBe(1);
  expect(audit?.total).toBe(0);
}

for (const state of ["revoked", "expired", "foreign", "missing"] as const) {
  it(`does not create a plan or audit with a ${state} initiating session`, async () => {
    const f = await identity();
    let token = f.token;
    if (state === "revoked") await sessionRepository.delete(token);
    if (state === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (state === "foreign") token = (await identity()).token;
    if (state === "missing") token = "";
    await expect(plans.command(create(f, token))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const [plan] = await db
      .select({ total: count() })
      .from(commercialPlans)
      .where(eq(commercialPlans.id, f.planId));
    const [version] = await db
      .select({ total: count() })
      .from(commercialPlanRevisions)
      .where(eq(commercialPlanRevisions.planId, f.planId));
    const [audit] = await db
      .select({ total: count() })
      .from(auditEvents)
      .where(eq(auditEvents.id, create(f).auditId));
    expect([plan?.total, version?.total, audit?.total]).toEqual([0, 0, 0]);
  });
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => Promise<boolean>, message: string) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}
async function waitForDatabaseLock(table: "commercial_plans" | "sessions") {
  await waitFor(async () => {
    const result = await db.execute<{ waiting: boolean }>(sql`select exists (
      select 1 from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
        and wait_event_type = 'Lock' and query like ${`%"${table}"%for%update%`}
    ) as waiting`);
    return result[0]?.waiting === true;
  }, `Command did not wait on ${table}`);
}

it("rejects a session revoked while publication waits for the plan lock", async () => {
  const f = await identity();
  await plans.command(create(f));
  const locked = deferred(),
    release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx
      .select({ id: commercialPlans.id })
      .from(commercialPlans)
      .where(eq(commercialPlans.id, f.planId))
      .for("update");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = plans.command(publish(f)).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForDatabaseLock("commercial_plans");
    await sessionRepository.delete(f.token);
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  await expectUnchanged(f);
}, 20000);

it("rejects expiry after the session-row lock wait even when its SELECT started while valid", async () => {
  const f = await identity();
  await plans.command(create(f));
  const expiresAt = new Date(Date.now() + 5000);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
  const locked = deferred(),
    release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, f.sessionId))
      .for("update");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = plans.command(publish(f)).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForDatabaseLock("sessions");
    await waitFor(async () => Date.now() >= expiresAt.getTime(), "Session did not expire");
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  await expectUnchanged(f);
}, 20000);
