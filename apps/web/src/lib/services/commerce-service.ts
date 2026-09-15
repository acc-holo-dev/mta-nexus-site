import { store } from "./store";
import { generateId } from "@nexus/security";
import { NotFoundError, ConflictError, eventBus } from "@nexus/domain";
import type { Order, Payment, License, LedgerEntry, User } from "@nexus/domain";

export class CommerceService {
  async createOrderAndCheckout(input: {
    buyer: User;
    productIds: string[];
    paymentProvider?: string;
    serverId?: string;
  }): Promise<{ order: Order; payment: Payment; licenses: License[] }> {
    const products = input.productIds.map((id) => {
      const p = store.products.get(id);
      if (!p) throw new NotFoundError("Product", id);
      return p;
    });

    const totalAmount = products.reduce((acc, p) => acc + p.price, 0);
    const orderId = generateId("ord");
    const orderNumber = `NX-${Math.floor(100000 + Math.random() * 900000)}`;

    const order: Order = {
      id: orderId,
      orderNumber,
      buyerId: input.buyer.id,
      status: "pending",
      totalAmount,
      currency: "USD",
      items: products.map((p) => ({
        id: generateId("ite"),
        orderId,
        productId: p.id,
        unitPrice: p.price,
        currency: "USD",
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    store.orders.set(orderId, order);

    // 1. Payment State Machine Initiation
    const paymentId = generateId("pay");
    const payment: Payment = {
      id: paymentId,
      orderId,
      amount: totalAmount,
      currency: "USD",
      provider: input.paymentProvider || "mock",
      providerTransactionId: "txn_" + generateId("ses"),
      status: "authorized",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 2. Transition Payment to COMPLETED
    payment.status = "completed";
    payment.updatedAt = new Date();
    store.payments.set(paymentId, payment);

    order.status = "completed";
    order.updatedAt = new Date();
    store.orders.set(orderId, order);

    // 3. Append-Only Financial Ledger entries
    // Platform fee: 7%
    const platformFee = Math.round(totalAmount * 0.07);
    const sellerEarnings = totalAmount - platformFee;

    const ledgerBuyer: LedgerEntry = {
      id: generateId("ldg"),
      accountId: `user:${input.buyer.id}`,
      amount: -totalAmount,
      currency: "USD",
      referenceType: "order",
      referenceId: orderId,
      balanceAfter: 0,
      description: `Purchase of order ${orderNumber}`,
      createdAt: new Date(),
    };

    const ledgerSeller: LedgerEntry = {
      id: generateId("ldg"),
      accountId: `developer:${products[0]?.authorId || "nexus"}`,
      amount: sellerEarnings,
      currency: "USD",
      referenceType: "order",
      referenceId: orderId,
      balanceAfter: sellerEarnings,
      description: `Payout for order ${orderNumber}`,
      createdAt: new Date(),
    };

    const ledgerNexus: LedgerEntry = {
      id: generateId("ldg"),
      accountId: "platform:nexus",
      amount: platformFee,
      currency: "USD",
      referenceType: "fee",
      referenceId: orderId,
      balanceAfter: platformFee,
      description: `Platform fee for order ${orderNumber}`,
      createdAt: new Date(),
    };

    store.ledgerEntries.push(ledgerBuyer, ledgerSeller, ledgerNexus);

    // 4. Provision Licenses and Entitlements
    const issuedLicenses: License[] = [];
    for (const prod of products) {
      prod.salesCount += 1;
      store.products.set(prod.id, prod);

      const licenseKey = `NX-${prod.type.slice(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const license: License = {
        id: generateId("lic"),
        key: licenseKey,
        productId: prod.id,
        userId: input.buyer.id,
        serverId: input.serverId,
        model: prod.licenseModel,
        status: "active",
        entitlements: ["server.run", "updates.download", "support.priority"],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.licenses.set(license.id, license);
      issuedLicenses.push(license);

      await eventBus.publish({
        id: generateId("evt"),
        type: "license.issued",
        version: 1,
        timestamp: new Date().toISOString(),
        actor: { id: input.buyer.id, type: "user" },
        aggregateId: license.id,
        aggregateType: "license",
        payload: {
          licenseId: license.id,
          productId: prod.id,
          buyerId: input.buyer.id,
          serverId: input.serverId,
          key: license.key,
        },
      });
    }

    await eventBus.publish({
      id: generateId("evt"),
      type: "payment.completed",
      version: 1,
      timestamp: new Date().toISOString(),
      actor: { id: input.buyer.id, type: "user" },
      aggregateId: payment.id,
      aggregateType: "payment",
      payload: {
        paymentId: payment.id,
        orderId: order.id,
        amount: payment.amount,
        transactionId: payment.providerTransactionId!,
      },
    });

    return { order, payment, licenses: issuedLicenses };
  }

  async getUserLicenses(userId: string): Promise<License[]> {
    return Array.from(store.licenses.values()).filter((l) => l.userId === userId);
  }

  async verifyLicense(key: string, serverId?: string): Promise<{ valid: boolean; license?: License; reason?: string }> {
    const license = Array.from(store.licenses.values()).find((l) => l.key === key);
    if (!license) return { valid: false, reason: "Invalid license key" };
    if (license.status !== "active") return { valid: false, reason: `License is ${license.status}` };
    if (license.expiresAt && license.expiresAt < new Date()) return { valid: false, reason: "License has expired" };
    if (license.serverId && serverId && license.serverId !== serverId) {
      return { valid: false, reason: "License is locked to a different server identity" };
    }

    return { valid: true, license };
  }
}

export const commerceService = new CommerceService();
