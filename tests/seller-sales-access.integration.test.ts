import { randomBytes } from "node:crypto";
import {
  db,
  orderItems,
  orders,
  organizationMembers,
  organizations,
  payments,
  products,
  sellerSalesRepository as repo,
  userRepository,
  users,
} from "@nexus/db";
import { and, eq, inArray } from "drizzle-orm";
import { expect, it } from "vitest";

// Disposable PostgreSQL migrated through 0063. Synthetic payment records are fixtures only;
// they never exercise provider settlement, entitlements, licenses or storage.
async function fixture(unsupportedCurrency = false) {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_sales_owner_${key}`,
    member = `usr_sales_member_${key}`,
    buyer = `usr_sales_buyer_${key}`,
    other = `usr_sales_other_${key}`,
    org = `org_sales_${key}`;
  const actorIds = [owner, member, buyer, other];
  for (const id of actorIds)
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role: "user",
    });
  await db
    .insert(organizations)
    .values({ id: org, name: "Sales organization", slug: org, ownerId: owner });
  await db.insert(organizationMembers).values({
    id: `om_sales_${key}`,
    organizationId: org,
    userId: member,
    role: "admin",
    permissions: ["manage_products"],
  });
  const personal = `prd_sales_personal_${key}`,
    team = `prd_sales_org_${key}`,
    foreign = `prd_sales_other_${key}`,
    productIds = [personal, team, foreign];
  for (const [id, authorId, organizationId] of [
    [personal, owner, null],
    [team, other, org],
    [foreign, other, null],
  ] as const)
    await db.insert(products).values({
      id,
      authorId,
      organizationId,
      title: id,
      description: "Sales fixture",
      slug: id,
      type: "script",
    });
  const free = `ord_sales_free_${key}`,
    paid = `ord_sales_paid_${key}`,
    foreignOrder = `ord_sales_other_${key}`,
    orderIds = [free, paid, foreignOrder],
    now = new Date();
  await db.insert(orders).values([
    {
      id: free,
      orderNumber: `FREE-${key}`,
      buyerId: buyer,
      status: "completed",
      totalAmount: 0,
      currency: "USD",
      createdAt: now,
    },
    {
      id: paid,
      orderNumber: `PAID-${key}`,
      buyerId: buyer,
      status: "completed",
      totalAmount: 300,
      currency: "USD",
      createdAt: now,
    },
    {
      id: foreignOrder,
      orderNumber: `OTHER-${key}`,
      buyerId: buyer,
      status: "completed",
      totalAmount: 500,
      currency: "RUB",
      createdAt: now,
    },
  ]);
  const freeLine = `itm_sales_free_${key}`,
    teamLine = `itm_sales_team_${key}`,
    personalLine = `itm_sales_personal_${key}`,
    foreignLine = `itm_sales_foreign_${key}`;
  await db.insert(orderItems).values([
    { id: freeLine, orderId: free, productId: personal, unitPrice: 0, currency: "USD" },
    { id: teamLine, orderId: paid, productId: team, unitPrice: 100, currency: "USD" },
    {
      id: personalLine,
      orderId: paid,
      productId: personal,
      unitPrice: 200,
      currency: unsupportedCurrency ? "XYZ" : "USD",
    },
    { id: foreignLine, orderId: foreignOrder, productId: foreign, unitPrice: 500, currency: "RUB" },
  ]);
  await db.insert(payments).values([
    {
      id: `pay_sales_${key}_capture`,
      orderId: paid,
      amount: 300,
      currency: "USD",
      provider: "fixture",
      providerTransactionId: "FIXTURE-SECRET",
      status: "completed",
    },
    {
      id: `pay_sales_${key}_failed`,
      orderId: paid,
      amount: 300,
      currency: "USD",
      provider: "fixture",
      status: "failed",
    },
  ]);
  return {
    key,
    owner,
    member,
    other,
    org,
    team,
    personal,
    paid,
    freeLine,
    teamLine,
    personalLine,
    foreignLine,
    async cleanup() {
      await db.delete(orders).where(inArray(orders.id, orderIds));
      await db.delete(products).where(inArray(products.id, productIds));
      await db.delete(organizations).where(eq(organizations.id, org));
      await db.delete(users).where(inArray(users.id, actorIds));
    },
  };
}
const query = { page: 1, days: "all" as const, status: "all" as const, evidence: "all" as const };
it("separates organization and personal lines while payments never multiply gross", async () => {
  const f = await fixture();
  try {
    const personal = await repo.report(f.owner, query);
    expect(personal.sales.map((row) => row.id).sort()).toEqual([f.freeLine, f.personalLine].sort());
    expect(personal.totals).toEqual([
      { currency: "USD", lines: 2, orders: 2, gross: "200", reviewLines: 0 },
    ]);
    const team = await repo.report(f.member, { ...query, organizationId: f.org });
    expect(team.sales.map((row) => row.id)).toEqual([f.teamLine]);
    expect(team.totals).toEqual([
      { currency: "USD", lines: 1, orders: 1, gross: "100", reviewLines: 0 },
    ]);
    expect(team.sales[0]?.evidence).toBe("capture_recorded");
    expect(team.periods.reduce((sum, row) => sum + BigInt(row.gross ?? "0"), 0n)).toBe(100n);
    const detail = await repo.detail(f.member, f.teamLine, f.org);
    expect(detail.sale).toMatchObject({ id: f.teamLine, unitPrice: 100 });
    expect(JSON.stringify(detail)).not.toMatch(
      /FIXTURE-SECRET|buyerId|orderAmount|providerTransactionId/,
    );
    await expect(repo.detail(f.member, f.personalLine, f.org)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(repo.report(f.owner, { ...query, productId: f.team })).rejects.toMatchObject({
      statusCode: 404,
    });
  } finally {
    await f.cleanup();
  }
});
it("revocation and product-management permissions do not grant financial access", async () => {
  const f = await fixture();
  try {
    expect((await repo.scopes(f.member)).scopes).toHaveLength(1);
    await db
      .update(organizationMembers)
      .set({ role: "developer" })
      .where(
        and(
          eq(organizationMembers.organizationId, f.org),
          eq(organizationMembers.userId, f.member),
        ),
      );
    expect((await repo.scopes(f.member)).scopes).toHaveLength(0);
    await expect(repo.report(f.member, { ...query, organizationId: f.org })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(repo.detail(f.member, f.teamLine, f.org)).rejects.toMatchObject({
      statusCode: 404,
    });
    await db.update(users).set({ role: "admin" }).where(eq(users.id, f.other));
    await expect(repo.report(f.other, { ...query, organizationId: f.org })).rejects.toMatchObject({
      statusCode: 404,
    });
  } finally {
    await f.cleanup();
  }
});
it("filters duplicate captures for review without changing values or financial state", async () => {
  const f = await fixture();
  try {
    await db.insert(payments).values({
      id: `pay_sales_${f.key}_duplicate`,
      orderId: f.paid,
      amount: 300,
      currency: "USD",
      provider: "fixture",
      status: "completed",
    });
    const team = await repo.report(f.owner, {
      ...query,
      organizationId: f.org,
      evidence: "review",
    });
    expect(team.totals).toEqual([
      { currency: "USD", lines: 1, orders: 1, gross: "100", reviewLines: 1 },
    ]);
    expect(team.sales[0]?.evidence).toBe("review");
    expect(
      (await repo.report(f.owner, { ...query, evidence: "free" })).sales.map((row) => row.id),
    ).toEqual([f.freeLine]);
    expect(
      (
        await repo.report(f.owner, {
          ...query,
          organizationId: f.org,
          evidence: "capture_recorded",
        })
      ).sales,
    ).toHaveLength(0);
    expect(await db.select().from(payments).where(eq(payments.orderId, f.paid))).toHaveLength(3);
    expect((await db.select().from(orders).where(eq(orders.id, f.paid)))[0]?.status).toBe(
      "completed",
    );
  } finally {
    await f.cleanup();
  }
});
it("aggregates supported currencies separately and leaves unknown currency values unsummed", async () => {
  const f = await fixture(true);
  try {
    const report = await repo.report(f.owner, query);
    expect(report.totals).toContainEqual({
      currency: "OTHER",
      lines: 1,
      orders: 1,
      gross: null,
      reviewLines: 1,
    });
    expect(report.totals).toContainEqual({
      currency: "USD",
      lines: 1,
      orders: 1,
      gross: "0",
      reviewLines: 0,
    });
    expect((await repo.report(f.owner, { ...query, currency: "RUB" })).sales).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
