import { createHash, randomUUID } from "node:crypto";
import {
  accountSubscriptions,
  auditEvents,
  db,
  organizationMembers,
  organizations,
  commercialPlanRepository as plans,
  sessionRepository,
  subscriptionReceipts,
  subscriptionsRepository as subscriptions,
  userRepository,
} from "@nexus/db";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";

// Disposable PostgreSQL migrated through 0066. Keep immutable periods, revisions
// and receipts until the database is discarded; do not bypass guards for cleanup.
async function fixture(organization = false, price = 0) {
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
  return { key, actor, owner, admin, planId, org, terms, command, currentToken };
}
it("concurrent exact activation requests create one period, receipt and audit", async () => {
  const f = await fixture(),
    results = await Promise.all(
      Array.from({ length: 4 }, () => subscriptions.command(f.actor, f.command)),
    ),
    first = results[0];
  if (!first) throw new Error("Missing fixture receipt");
  expect(results.filter((r) => !r.replayed)).toHaveLength(1);
  expect(new Set(results.map((r) => r.receipt.id)).size).toBe(1);
  expect(
    await db
      .select()
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.id, first.receipt.subscription.id)),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(subscriptionReceipts)
      .where(eq(subscriptionReceipts.id, first.receipt.id)),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetId, first.receipt.subscription.id),
          eq(auditEvents.action, "commerce.subscription_activated_free"),
        ),
      ),
  ).toHaveLength(1);
  expect(
    first.receipt.subscription.expiresAt.getTime() - first.receipt.subscription.startedAt.getTime(),
  ).toBe(30 * 86400000);
});
it("different requests cannot create overlapping active periods", async () => {
  const f = await fixture(),
    results = await Promise.allSettled([
      subscriptions.command(f.actor, f.command),
      subscriptions.command(f.actor, { ...f.command, requestId: randomUUID() }),
    ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    status: "rejected",
    reason: { code: "SUBSCRIPTION_ALREADY_ACTIVE" },
  });
});
it("terms survive withdrawal, cancellation is idempotent and immediately restores baseline estimates", async () => {
  const f = await fixture(),
    saved = await subscriptions.command(f.actor, f.command),
    id = saved.receipt.subscription.id;
  await plans.command({
    currentToken: f.currentToken,
    actorId: f.admin,
    planId: f.planId,
    auditId: `aud_sub_archive_${f.key}`,
    command: { action: "archive", expectedRevision: 2, reason: "Withdraw subscription fixture" },
  });
  expect((await subscriptions.dashboard(f.actor)).commissionBps).toBe(750);
  expect((await subscriptions.command(f.actor, f.command)).replayed).toBe(true);
  const cancel = { action: "cancel" as const, requestId: randomUUID(), subscriptionId: id },
    ended = await subscriptions.command(f.actor, cancel);
  expect(ended.receipt.subscription.status).toBe("cancelled");
  expect(ended.receipt.subscription.expiresAt).toEqual(saved.receipt.subscription.expiresAt);
  expect((await subscriptions.command(f.actor, cancel)).replayed).toBe(true);
  expect((await subscriptions.dashboard(f.actor)).commissionBps).toBe(1000);
  expect((await subscriptions.detail(f.actor, saved.receipt.id)).receipt.subscription.status).toBe(
    "active",
  );
  expect((await subscriptions.detail(f.actor, saved.receipt.id)).current.status).toBe("cancelled");
  await expect(
    db
      .update(accountSubscriptions)
      .set({ expiresAt: new Date(Date.now() + 86400000) })
      .where(eq(accountSubscriptions.id, id)),
  ).rejects.toThrow();
  await expect(
    db.delete(subscriptionReceipts).where(eq(subscriptionReceipts.id, saved.receipt.id)),
  ).rejects.toThrow();
});
it("organization administrators share the current period and revoked rights block reads and retries", async () => {
  const f = await fixture(true),
    saved = await subscriptions.command(f.actor, f.command);
  expect((await subscriptions.dashboard(f.owner, f.org)).subscription?.id).toBe(
    saved.receipt.subscription.id,
  );
  await db
    .update(organizationMembers)
    .set({ role: "developer" })
    .where(
      and(eq(organizationMembers.organizationId, f.org), eq(organizationMembers.userId, f.actor)),
    );
  await expect(subscriptions.command(f.actor, f.command)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(subscriptions.detail(f.actor, saved.receipt.id, f.org)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
});
it("paid plans cannot create a period through repository or direct database insert", async () => {
  const f = await fixture(false, 1000);
  await expect(subscriptions.command(f.actor, f.command)).rejects.toMatchObject({
    code: "SUBSCRIPTION_PAYMENT_REQUIRED",
  });
  await expect(
    db.insert(accountSubscriptions).values({
      id: `sub_forged_${f.key}`,
      actorId: f.actor,
      subjectType: "user",
      subjectId: f.actor,
      planId: f.planId,
      planRevision: 2,
    }),
  ).rejects.toThrow();
  expect(
    await db.select().from(accountSubscriptions).where(eq(accountSubscriptions.subjectId, f.actor)),
  ).toHaveLength(0);
});
it("audit failure rolls back both period and receipt without consuming the request", async () => {
  const f = await fixture(),
    key = createHash("sha256")
      .update(JSON.stringify({ actorId: f.actor, requestId: f.command.requestId.toLowerCase() }))
      .digest("hex");
  await db.insert(auditEvents).values({
    id: `aud_sub_${key}`,
    actorId: f.actor,
    actorType: "user",
    action: "fixture.audit_collision",
    targetId: f.planId,
    targetType: "subscription",
    details: {},
  });
  await expect(subscriptions.command(f.actor, f.command)).rejects.toThrow();
  expect(
    await db
      .select()
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.id, `sub_${key}`)),
  ).toHaveLength(0);
  expect(
    await db
      .select()
      .from(subscriptionReceipts)
      .where(eq(subscriptionReceipts.id, `srec_${key}`)),
  ).toHaveLength(0);
});
