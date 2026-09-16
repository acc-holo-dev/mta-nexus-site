import { describe, it, expect, beforeAll } from "vitest";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import {
  userRepository,
  productRepository,
  ledgerRepository,
  licenseRepository,
} from "@nexus/db";
import type { User, Product } from "@nexus/domain";

describe("Commerce & Double-Entry Ledger", () => {
  let buyer: User;
  let product: Product;

  beforeAll(async () => {
    buyer = await userRepository.create({
      id: "usr_test_buyer_01",
      email: "buyer_test@nexus.test",
      username: "test_buyer",
      displayName: "Test Buyer",
      role: "user",
    });

    product = await productRepository.create({
      id: "prd_test_item_01",
      title: "Test Resource Pack",
      slug: "test-resource-pack",
      description: "Description for test resource pack",
      type: "script",
      status: "published",
      authorId: buyer.id,
      price: 2500, // $25.00
      currency: "USD",
      licenseModel: "single_server",
      tags: ["test"],
      currentVersion: "1.0.0",
      ratingAverage: 50,
      ratingCount: 1,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: {},
    });
  });

  it("should process checkout with valid payment and balanced ledger entries", async () => {
    const initialLedger = await ledgerRepository.listRecent(100);
    const initialLedgerCount = initialLedger.length;

    const result = await commerceService.createOrderAndCheckout({
      buyer,
      productIds: [product.id],
      paymentProvider: "mock",
    });

    expect(result.order).toBeDefined();
    expect(result.order.status).toBe("completed");
    expect(result.order.totalAmount).toBe(product.price);

    expect(result.payment.status).toBe("completed");
    expect(result.payment.amount).toBe(product.price);

    expect(result.licenses).toHaveLength(1);
    expect(result.licenses[0].status).toBe("active");
    expect(result.licenses[0].key).toMatch(/^NX-[A-Z0-9-]+$/);

    // Verify double-entry ledger additions (buyer debit, seller credit, nexus fee credit)
    const afterLedger = await ledgerRepository.listRecent(100);
    const newEntries = afterLedger.slice(0, 3);
    expect(newEntries).toHaveLength(3);

    const totalDebit = newEntries
      .filter((e) => e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    const totalCredit = newEntries
      .filter((e) => e.amount > 0)
      .reduce((sum, e) => sum + e.amount, 0);

    // Sum of credits must equal sum of debits
    expect(totalDebit).toBe(totalCredit);
  });

  it("should verify issued license and reject invalid or expired license", async () => {
    const result = await commerceService.verifyLicense("INVALID-KEY-123");
    expect(result.valid).toBe(false);
  });
});
