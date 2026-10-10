import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db, userRepository, commercialPlanRepository, orderOperationsRepository } from "@nexus/db";
import {
  auditEvents,
  commercialPlanRevisions,
  ledgerEntries,
  orderCancellationReceipts,
  orders,
  payments,
} from "../packages/db/src/schema";

// Requires a disposable PostgreSQL database migrated through 0047. No payments
// are sent to a provider; inserts below exercise the transactional safety gates.
describe("commercial operation persistence and concurrency", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`,
    buyer = `usr_commerce_${suffix}`,
    admin = `usr_plan_${suffix}`;
  beforeAll(async () => {
    for (const [id, role] of [
      [buyer, "user"],
      [admin, "admin"],
    ] as const)
      await userRepository.create({
        id,
        role,
        email: `${id}@nexus.test`,
        username: id,
        displayName: "Commercial fixture",
      });
  });
  async function pending(name: string) {
    const id = `ord_${name}_${suffix}`;
    const [order] = await db
      .insert(orders)
      .values({
        id,
        orderNumber: `test-${name}-${suffix}`,
        buyerId: buyer,
        status: "pending",
        totalAmount: 999,
        currency: "USD",
      })
      .returning();
    if (!order) throw new Error("Missing fixture order");
    return order;
  }
  const payment = (orderId: string, name: string) => ({
    id: `pay_${name}_${suffix}`,
    orderId,
    provider: "fixture",
    amount: 999,
    currency: "USD",
    status: "failed",
  });
  const financial = (orderId: string, name: string) => ({
    id: `led_${name}_${suffix}`,
    accountId: `user:${buyer}`,
    amount: -100,
    currency: "USD",
    referenceType: "fee",
    referenceId: orderId,
    balanceAfter: 0,
    description: "Fixture fee reference",
  });
  it("records exactly one cancellation/audit when the same request is retried concurrently", async () => {
    const order = await pending("replay"),
      command = {
        requestId: randomUUID(),
        expectedUpdatedAt: order.updatedAt.toISOString(),
        reason: "Fixture unpaid cancellation",
      };
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        orderOperationsRepository.cancel({
          buyerId: buyer,
          orderId: order.id,
          command,
          auditId: `aud_replay_${index}_${suffix}`,
        }),
      ),
    );
    expect(new Set(results.map((result) => result.cancelledAt.toISOString())).size).toBe(1);
    const [receipts] = await db
      .select({ total: count() })
      .from(orderCancellationReceipts)
      .where(eq(orderCancellationReceipts.orderId, order.id));
    const [audits] = await db
      .select({ total: count() })
      .from(auditEvents)
      .where(
        and(eq(auditEvents.targetId, order.id), eq(auditEvents.action, "order.unpaid_cancelled")),
      );
    expect(receipts?.total).toBe(1);
    expect(audits?.total).toBe(1);
    await expect(db.insert(payments).values(payment(order.id, "after_cancel"))).rejects.toThrow();
    await expect(
      db.insert(ledgerEntries).values(financial(order.id, "after_cancel")),
    ).rejects.toThrow();
    await expect(
      db.update(orders).set({ status: "pending" }).where(eq(orders.id, order.id)),
    ).rejects.toThrow();
  });
  it("serializes direct SQL payment insertion against cancellation", async () => {
    const order = await pending("race"),
      command = {
        requestId: randomUUID(),
        expectedUpdatedAt: order.updatedAt.toISOString(),
        reason: "Fixture cancellation race",
      };
    const results = await Promise.allSettled([
      orderOperationsRepository.cancel({
        buyerId: buyer,
        orderId: order.id,
        command,
        auditId: `aud_race_${suffix}`,
      }),
      db.insert(payments).values(payment(order.id, "race")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const [current] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, order.id));
    const [attempts] = await db
      .select({ total: count() })
      .from(payments)
      .where(eq(payments.orderId, order.id));
    expect(
      current?.status === "cancelled"
        ? attempts?.total === 0
        : current?.status === "pending" && attempts?.total === 1,
    ).toBe(true);
  });
  it("blocks cancellation on fee references even without any payment attempt", async () => {
    const order = await pending("fee");
    await db.insert(ledgerEntries).values(financial(order.id, "fee"));
    await expect(
      orderOperationsRepository.cancel({
        buyerId: buyer,
        orderId: order.id,
        command: {
          requestId: randomUUID(),
          expectedUpdatedAt: order.updatedAt.toISOString(),
          reason: "Fixture fee reconciliation",
        },
        auditId: `aud_fee_${suffix}`,
      }),
    ).rejects.toMatchObject({ code: "ORDER_RECONCILIATION_REQUIRED" });
    await expect(
      db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id)),
    ).rejects.toThrow();
  });
  it("keeps published plan snapshots immutable and rejects stale revisions", async () => {
    const planId = `cplan_fixture_${suffix}`,
      terms = {
        titleRu: "Тариф теста",
        titleEn: "Fixture plan",
        descriptionRu: "Описание тестового тарифа",
        descriptionEn: "Fixture published plan terms",
        price: 999,
        currency: "USD" as const,
        durationDays: 30 as const,
        commissionBps: 750,
      };
    await commercialPlanRepository.command({
      actorId: admin,
      planId,
      auditId: `aud_create_${suffix}`,
      command: {
        action: "create",
        slug: `fixture-${suffix.replaceAll("_", "-")}`,
        scope: "user",
        terms,
        reason: "Create fixture terms",
      },
    });
    await commercialPlanRepository.command({
      actorId: admin,
      planId,
      auditId: `aud_publish_${suffix}`,
      command: { action: "publish", expectedRevision: 1, reason: "Review fixture terms" },
    });
    await expect(
      commercialPlanRepository.command({
        actorId: admin,
        planId,
        auditId: `aud_stale_${suffix}`,
        command: { action: "save", expectedRevision: 1, terms, reason: "Stale fixture version" },
      }),
    ).rejects.toMatchObject({ code: "COMMERCIAL_PLAN_CONFLICT" });
    await expect(
      db
        .update(commercialPlanRevisions)
        .set({ reason: "Rewrite old snapshot" })
        .where(eq(commercialPlanRevisions.planId, planId)),
    ).rejects.toThrow();
    await expect(
      db.delete(commercialPlanRevisions).where(eq(commercialPlanRevisions.planId, planId)),
    ).rejects.toThrow();
    const published = await commercialPlanRepository.published(planId);
    expect(published).toMatchObject({ revision: 2, status: "published", commissionBps: 750 });
  });
});
