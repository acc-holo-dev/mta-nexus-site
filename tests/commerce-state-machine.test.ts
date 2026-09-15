import { describe, it, expect } from "vitest";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import { store } from "../apps/web/src/lib/services/store";

describe("Commerce & Double-Entry Ledger", () => {
  const buyer = store.users.get("usr_player_001")!;
  const product = store.products.get("prd_inv_pro")!;

  it("should process checkout with valid payment and balanced ledger entries", async () => {
    const initialLedgerCount = store.ledgerEntries.length;

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
    const newEntries = store.ledgerEntries.slice(initialLedgerCount);
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
});
