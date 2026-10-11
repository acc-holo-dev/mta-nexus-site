import { createHash, randomBytes } from "node:crypto";
import {
  auditEvents,
  builds,
  db,
  orderItems,
  orderRepository,
  orders,
  organizations,
  payments,
  products,
  sellerSalesRepository as sales,
  orderTermsRepository as terms,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray } from "drizzle-orm";
import { expect, it } from "vitest";

// Disposable PostgreSQL migrated through 0063. Synthetic statuses are persistence
// fixtures only: no payment provider, grants, license issuance or storage is used.
async function fixture() {
  const key = randomBytes(8).toString("hex"),
    seller = `usr_terms_seller_${key}`,
    buyer = `usr_terms_buyer_${key}`,
    other = `usr_terms_other_${key}`,
    admin = `usr_terms_admin_${key}`,
    product = `prd_terms_${key}`,
    build = `bld_terms_${key}`,
    id = `ord_terms_${key}`,
    org = `org_terms_${key}`;
  for (const [userId, role] of [
    [seller, "developer"],
    [buyer, "user"],
    [other, "user"],
    [admin, "admin"],
  ] as const)
    await userRepository.create({
      id: userId,
      role,
      email: `${userId}@example.invalid`,
      username: userId,
      displayName: userId,
    });
  await db
    .insert(organizations)
    .values({ id: org, name: "Changed owner", slug: org, ownerId: other });
  await db.insert(products).values({
    id: product,
    authorId: seller,
    title: "Original recorded title",
    slug: product,
    description: "Order terms fixture",
    type: "script",
    status: "published",
    price: 100,
    currency: "USD",
    licenseModel: "single_server",
  });
  await db.insert(builds).values({
    id: build,
    productId: product,
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "integration",
    scannedAt: new Date(),
    storageKey: `fixture/terms_${key}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
  });
  const line = `itm_terms_${key}`,
    created = await orderRepository.create({
      id,
      orderNumber: `TERMS-${key}`,
      buyerId: buyer,
      status: "pending",
      totalAmount: 100,
      currency: "USD",
      items: [{ id: line, orderId: id, productId: product, unitPrice: 100, currency: "USD" }],
    });
  const orderIds = [id];
  return {
    key,
    seller,
    buyer,
    other,
    admin,
    product,
    line,
    id,
    org,
    created,
    orderIds,
    async cleanup() {
      await db.delete(orders).where(inArray(orders.id, orderIds));
      await db.delete(auditEvents).where(inArray(auditEvents.targetId, orderIds));
      await db.delete(builds).where(eq(builds.id, build));
      await db.delete(products).where(eq(products.id, product));
      await db.delete(organizations).where(eq(organizations.id, org));
      await db.delete(users).where(inArray(users.id, [seller, buyer, other, admin]));
    },
  };
}
it("records source terms atomically and preserves original seller/title after catalog changes", async () => {
  const f = await fixture();
  try {
    const report = await terms.report(f.buyer, f.id, "buyer");
    expect(report.summary).toMatchObject({
      legacyLines: 0,
      recordedLines: 1,
      amountMismatch: false,
      currencyMismatch: false,
    });
    expect(report.lines[0]?.terms).toMatchObject({
      seller: { type: "user", id: f.seller },
      product: { title: "Original recorded title" },
      baseline: { commissionBps: 1000, holdDays: 7 },
    });
    await db
      .update(products)
      .set({ title: "PRIVATE NEW TITLE", authorId: f.other, organizationId: f.org, price: 999 })
      .where(eq(products.id, f.product));
    const original = await terms.report(f.buyer, f.id, "buyer");
    expect(original.lines[0]?.terms).toEqual(report.lines[0]?.terms);
    expect(JSON.stringify(original)).not.toContain("PRIVATE NEW TITLE");
    // A synthetic completed record exercises attribution only, never settlement.
    await db.update(orders).set({ status: "completed" }).where(eq(orders.id, f.id));
    const query = {
      page: 1,
      days: "all" as const,
      status: "all" as const,
      evidence: "all" as const,
    };
    expect(
      (await sales.report(f.seller, { ...query, attribution: "portfolio" })).sales,
    ).toHaveLength(0);
    const captured = await sales.report(f.seller, {
      ...query,
      attribution: "recorded",
      productId: f.product,
    });
    expect(captured.sales[0]).toMatchObject({
      id: f.line,
      productTitle: "Original recorded title",
      titleSource: "recorded",
      inCurrentPortfolio: false,
    });
    expect(captured.product?.title).toBe("Original recorded title");
    expect((await sales.detail(f.seller, f.line, undefined, "recorded")).sale.productTitle).toBe(
      "Original recorded title",
    );
    expect(
      (await sales.report(f.other, { ...query, attribution: "recorded", organizationId: f.org }))
        .sales,
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
it("refuses altered snapshot, line economics, parent economics and caller-supplied terms", async () => {
  const f = await fixture();
  try {
    await expect(
      db.update(orderItems).set({ unitPrice: 101 }).where(eq(orderItems.id, f.line)),
    ).rejects.toThrow();
    await expect(
      db.update(orderItems).set({ commercialSnapshot: null }).where(eq(orderItems.id, f.line)),
    ).rejects.toThrow();
    await expect(db.delete(orderItems).where(eq(orderItems.id, f.line))).rejects.toThrow();
    await expect(
      db.update(orders).set({ totalAmount: 101 }).where(eq(orders.id, f.id)),
    ).rejects.toThrow();
    await expect(
      db.update(orders).set({ buyerId: f.other }).where(eq(orders.id, f.id)),
    ).rejects.toThrow();
    const [row] = await db.select().from(orderItems).where(eq(orderItems.id, f.line));
    if (!row?.commercialSnapshot) throw new Error("Missing snapshot");
    await expect(
      db.insert(orderItems).values({
        id: `itm_forged_${f.key}`,
        orderId: f.id,
        productId: f.product,
        unitPrice: 100,
        currency: "USD",
        commercialSnapshot: row.commercialSnapshot,
      }),
    ).rejects.toThrow();
    expect((await terms.report(f.buyer, f.id, "buyer")).summary.lines).toBe(1);
  } finally {
    await f.cleanup();
  }
});
it("financial references seal line additions and order inspection rechecks live authority", async () => {
  const f = await fixture();
  try {
    await db.insert(payments).values({
      id: `pay_terms_${f.key}`,
      orderId: f.id,
      amount: 100,
      currency: "USD",
      provider: "fixture",
      status: "failed",
    });
    await expect(
      db.insert(orderItems).values({
        id: `itm_late_${f.key}`,
        orderId: f.id,
        productId: f.product,
        unitPrice: 100,
        currency: "USD",
      }),
    ).rejects.toThrow();
    await expect(terms.report(f.other, f.id, "buyer")).rejects.toMatchObject({ statusCode: 404 });
    expect((await terms.report(f.admin, f.id, "admin")).lines).toHaveLength(1);
    await db.update(users).set({ role: "moderator" }).where(eq(users.id, f.admin));
    await expect(terms.report(f.admin, f.id, "admin")).rejects.toMatchObject({ statusCode: 403 });
  } finally {
    await f.cleanup();
  }
});
it("parent revision touch rejects a stale repeatable-read economics writer", async () => {
  const f = await fixture();
  let resume = () => {},
    started = () => {};
  const ready = new Promise<void>((resolve) => {
      started = resolve;
    }),
    proceed = new Promise<void>((resolve) => {
      resume = resolve;
    });
  let stale: Promise<unknown> | undefined;
  try {
    const root = `ord_terms_race_${f.key}`;
    f.orderIds.push(root);
    await db.insert(orders).values({
      id: root,
      orderNumber: root,
      buyerId: f.buyer,
      status: "pending",
      totalAmount: 100,
      currency: "USD",
    });
    stale = db.transaction(
      async (tx) => {
        await tx.select().from(orders).where(eq(orders.id, root));
        started();
        await proceed;
        await tx.update(orders).set({ totalAmount: 101 }).where(eq(orders.id, root));
      },
      { isolationLevel: "repeatable read" },
    );
    await ready;
    await db.insert(orderItems).values({
      id: `itm_race_${f.key}`,
      orderId: root,
      productId: f.product,
      unitPrice: 100,
      currency: "USD",
    });
    resume();
    await expect(stale).rejects.toMatchObject({ cause: { code: "40001" } });
    expect((await terms.report(f.buyer, root, "buyer")).summary.amountMismatch).toBe(false);
  } finally {
    resume();
    await stale?.catch(() => {});
    await f.cleanup();
  }
});

it("concurrent exact requests commit one order, one snapshot and one audit", async () => {
  const f = await fixture();
  try {
    const id = `ord_retry_${f.key}`,
      line = `itm_retry_${f.key}`;
    f.orderIds.push(id);
    const request = {
      id,
      orderNumber: id,
      buyerId: f.buyer,
      status: "pending" as const,
      totalAmount: 100,
      currency: "USD",
      items: [{ id: line, orderId: id, productId: f.product, unitPrice: 100, currency: "USD" }],
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => orderRepository.create(request)),
    );
    expect(new Set(results.map((r) => r.updatedAt.toISOString())).size).toBe(1);
    expect(await db.select().from(orderItems).where(eq(orderItems.orderId, id))).toHaveLength(1);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.targetId, id))).toHaveLength(1);
    await expect(
      orderRepository.create({ ...request, orderNumber: "changed" }),
    ).rejects.toMatchObject({ code: "ORDER_REQUEST_CONFLICT" });
  } finally {
    await f.cleanup();
  }
});
it("audit failure rolls back new order lines and all recorded terms", async () => {
  const f = await fixture();
  try {
    const id = `ord_audit_${f.key}`,
      line = `itm_audit_${f.key}`;
    f.orderIds.push(id);
    await db
      .insert(auditEvents)
      .values({
        id: `aud_order_${createHash("sha256").update(id).digest("hex")}`,
        actorId: f.buyer,
        action: "fixture.audit_collision",
        targetId: id,
        targetType: "order",
      });
    await expect(
      orderRepository.create({
        id,
        orderNumber: id,
        buyerId: f.buyer,
        status: "pending",
        totalAmount: 100,
        currency: "USD",
        items: [{ id: line, orderId: id, productId: f.product, unitPrice: 100, currency: "USD" }],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(orders).where(eq(orders.id, id))).toHaveLength(0);
    expect(await db.select().from(orderItems).where(eq(orderItems.id, line))).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
