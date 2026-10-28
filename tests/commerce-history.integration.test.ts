import { describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  licenses,
  orders,
  orderItems,
  products,
  users,
  licenseRepository,
  orderRepository,
  productRepository,
  userRepository,
} from "@nexus/db";

describe("private historical commerce queries (PostgreSQL)", () => {
  it("paginates buyer orders and seller items without cross-account data", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    const buyerA = `usr_hist_ba_${suffix}`;
    const buyerB = `usr_hist_bb_${suffix}`;
    const sellerA = `usr_hist_sa_${suffix}`;
    const sellerB = `usr_hist_sb_${suffix}`;
    const actorIds = [buyerA, buyerB, sellerA, sellerB];
    const productA = `prd_hist_a_${suffix}`;
    const productB = `prd_hist_b_${suffix}`;
    const productIds = [productA, productB];
    const orderIds = Array.from(
      { length: 24 },
      (_, index) => `ord_hist_${suffix}_${String(index).padStart(2, "0")}`,
    );
    const licenseIds = Array.from({ length: 3 }, (_, index) => `lic_hist_${suffix}_${index}`);
    try {
      for (const [index, id] of actorIds.entries()) {
        await userRepository.create({
          id,
          username: `history_${index}_${suffix}`,
          email: `history_${index}_${suffix}@nexus.test`,
          displayName: "Commerce history test",
          role: index >= 2 ? "developer" : "user",
        });
      }

      const base = {
        description: "A historical commerce query fixture",
        type: "script" as const,
        status: "published" as const,
        currency: "USD",
        price: 5000,
        licenseModel: "single_server" as const,
        tags: [],
        currentVersion: "1.0.0",
        ratingAverage: 0,
        ratingCount: 0,
        salesCount: 0,
        isFeatured: false,
        screenshots: [],
        compatibility: {},
      };
      for (const [index, productId] of productIds.entries()) {
        await productRepository.create({
          ...base,
          id: productId,
          slug: `historical-${index}-${suffix}`,
          authorId: index === 0 ? sellerA : sellerB,
          title: `Historical product ${index}`,
        });
      }

      const sameTimestamp = new Date("2026-10-09T00:00:00.000Z");
      // order_line_terms_guard rejects new lines once an order is cancelled or has
      // payments/ledger refs — insert lines while pending, then settle status.
      await db.insert(orders).values(
        orderIds.map((id, index) => ({
          id,
          orderNumber: `HIST-${suffix}-${index}`,
          buyerId: index < 23 ? buyerA : buyerB,
          status: "pending",
          totalAmount: 12345,
          currency: "USD",
          createdAt: sameTimestamp,
          updatedAt: sameTimestamp,
        })),
      );
      await db.insert(orderItems).values(
        orderIds.map((id, index) => ({
          id: `itm_hist_${suffix}_${index}`,
          orderId: id,
          productId: index < 23 ? productA : productB,
          unitPrice: 12345,
          currency: "USD",
        })),
      );
      for (const [index, id] of orderIds.entries()) {
        await db
          .update(orders)
          .set({
            status: index === 5 ? "cancelled" : "completed",
            updatedAt: sameTimestamp,
          })
          .where(eq(orders.id, id));
      }

      await db.insert(licenses).values(
        licenseIds.map((id, index) => ({
          id,
          key: `PRIVATE-HISTORY-${suffix}-${index}`,
          productId: index === 2 ? productB : productA,
          userId: index === 2 ? buyerB : buyerA,
          model: "single_server",
          status: index === 1 ? "revoked" : "active",
          expiresAt: index === 0 ? new Date("2020-01-01T00:00:00.000Z") : null,
          entitlements: ["product.download"],
          createdAt: sameTimestamp,
          updatedAt: sameTimestamp,
        })),
      );

      const first = await orderRepository.pageBuyerHistory(buyerA, 1);
      const second = await orderRepository.pageBuyerHistory(buyerA, 2);
      expect(first).toMatchObject({ total: 23, page: 1, pageSize: 20, totalPages: 2 });
      expect(first.orders).toHaveLength(20);
      expect(second.orders).toHaveLength(3);
      expect(first.orders[0]?.id).toBe(orderIds[22]);
      expect(second.orders[0]?.id).toBe(orderIds[2]);
      expect(first.orders.every((row) => !("buyerId" in row))).toBe(true);
      expect(first.orders.every((row) => !("payment" in row))).toBe(true);
      expect((await orderRepository.pageBuyerHistory(buyerA, 1_000)).page).toBe(2);
      expect((await orderRepository.pageBuyerHistory(buyerB)).orders.map((row) => row.id)).toEqual([
        orderIds[23],
      ]);
      expect((await orderRepository.pageBuyerHistory(sellerA)).total).toBe(0);

      const ownLicenses = await licenseRepository.pageUserHistory(buyerA);
      expect(ownLicenses.total).toBe(2);
      expect(ownLicenses.licenses).toHaveLength(2);
      expect(
        ownLicenses.licenses.every(
          (row) =>
            !("key" in row) &&
            !("userId" in row) &&
            !("serverId" in row) &&
            !("entitlements" in row),
        ),
      ).toBe(true);
      expect((await licenseRepository.pageUserHistory(buyerB)).total).toBe(1);
      expect((await licenseRepository.pageUserHistory(sellerA)).total).toBe(0);

      const sellerHistory = await orderRepository.pageSellerHistory(sellerA);
      expect(sellerHistory).toMatchObject({ total: 22, page: 1, totalPages: 2 });
      expect(sellerHistory.sales).toHaveLength(20);
      expect(
        sellerHistory.sales.every(
          (row) => !("buyerId" in row) && !("paymentId" in row) && !("buyerEmail" in row),
        ),
      ).toBe(true);
      expect((await orderRepository.pageSellerHistory(sellerA, 2)).sales).toHaveLength(2);
      expect((await orderRepository.pageSellerHistory(sellerB)).total).toBe(1);
      expect((await orderRepository.pageSellerHistory(buyerA)).total).toBe(0);
    } finally {
      await db.delete(licenses).where(inArray(licenses.id, licenseIds));
      await db.delete(orders).where(inArray(orders.id, orderIds));
      await db.delete(products).where(inArray(products.id, productIds));
      await db.delete(users).where(inArray(users.id, actorIds));
    }
  });
});
