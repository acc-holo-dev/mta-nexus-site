import { randomUUID } from "node:crypto";
import {
  accountSubscriptions,
  auditEvents,
  db,
  organizationMembers,
  organizations,
  commercialPlanRepository as plans,
  sessionRepository,
  subscriptionReceipts,
  userRepository,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect } from "vitest";

// Disposable PostgreSQL migrated through 0066. Keep immutable periods, revisions
// and receipts until the database is discarded; do not bypass guards for cleanup.

/** Seed users, optional org membership, a published plan, and initiating sessions. */
export async function fixture(organization = false, price = 0) {
  const key = randomUUID().replaceAll("-", ""),
    actor = `usr_sub_${key}`,
    owner = `usr_sub_owner_${key}`,
    admin = `usr_sub_admin_${key}`,
    planId = `cplan_sub_${key}`,
    org = `org_sub_${key}`;
  for (const [id, role] of [
    [actor, "user"],
    [owner, "user"],
    [admin, "admin"],
  ] as const)
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role,
    });
  if (organization) {
    await db
      .insert(organizations)
      .values({ id: org, ownerId: owner, name: "Subscription fixture org", slug: org });
    await db
      .insert(organizationMembers)
      .values({ id: `member_sub_${key}`, organizationId: org, userId: actor, role: "admin" });
  }
  const currentToken = `plan-token-${key}`;
  await sessionRepository.create({
    id: `ses_sub_${key}`,
    userId: admin,
    token: currentToken,
    expiresAt: new Date(Date.now() + 3600000),
  });
  const actorToken = `subscription-token-${key}`;
  await sessionRepository.create({
    id: `ses_sub_actor_${key}`,
    userId: actor,
    token: actorToken,
    expiresAt: new Date(Date.now() + 3600000),
  });
  const terms = {
    titleRu: "Бесплатный тариф",
    titleEn: "Free fixture plan",
    descriptionRu: "Описание тарифа для проверки",
    descriptionEn: "Plan description for fixtures",
    price,
    currency: "USD" as const,
    durationDays: 30 as const,
    commissionBps: 750,
  };
  await plans.command({
    currentToken,
    actorId: admin,
    planId,
    auditId: `aud_sub_create_${key}`,
    command: {
      action: "create",
      slug: `sub-${key}`,
      scope: organization ? "organization" : "user",
      terms,
      reason: "Create subscription fixture",
    },
  });
  await plans.command({
    currentToken,
    actorId: admin,
    planId,
    auditId: `aud_sub_publish_${key}`,
    command: { action: "publish", expectedRevision: 1, reason: "Publish subscription fixture" },
  });
  const command = {
    action: "activate" as const,
    requestId: randomUUID(),
    planId,
    expectedRevision: 2,
    ...(organization ? { organizationId: org } : {}),
  };
  return { key, actor, owner, admin, planId, org, terms, command, currentToken, actorToken };
}

/** Assert the actor left no period, receipt, or audit after a rejected activation. */
export async function expectNoActivation(f: Awaited<ReturnType<typeof fixture>>) {
  expect(
    await db.select().from(accountSubscriptions).where(eq(accountSubscriptions.actorId, f.actor)),
  ).toHaveLength(0);
  expect(
    await db.select().from(subscriptionReceipts).where(eq(subscriptionReceipts.actorId, f.actor)),
  ).toHaveLength(0);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actor))).toHaveLength(
    0,
  );
}

/** Create a deferred promise pair for lock-wait fixtures. */
export function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Wait until another backend holds a row lock on the named subscription table. */
export async function waitForLock(table: "commercial_plans" | "account_subscriptions") {
  const until = Date.now() + 4000;
  while (Date.now() < until) {
    const result = await db.execute<{ waiting: boolean }>(sql`select exists (
      select 1 from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
        and wait_event_type = 'Lock' and query like ${`%"${table}"%for%`}
    ) as waiting`);
    if (result[0]?.waiting === true) return;
    await new Promise((done) => setTimeout(done, 10));
  }
  throw new Error(`Subscription command did not wait on ${table}`);
}
