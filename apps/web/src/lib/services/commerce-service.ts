import {
  orderRepository,
  paymentRepository,
  licenseRepository,
  ledgerRepository,
  entitlementRepository,
  productRepository,
  auditRepository,
} from "@nexus/db";
import { generateId } from "@nexus/security";
import { NotFoundError, eventBus } from "@nexus/domain";
import type { Order, Payment, License, LedgerEntry, User } from "@nexus/domain";

export class CommerceService {
  async createOrderAndCheckout(input: {
    buyer: User;
    productIds: string[];
    paymentProvider?: string;
    serverId?: string;
  }): Promise<{ order: Order; payment: Payment; licenses: License[] }> {
    const products = [];
    for (const id of input.productIds) {
      const p = await productRepository.findById(id);
      if (!p) throw new NotFoundError("Product", id);
      products.push(p);
    }

    const totalAmount = products.reduce((acc, p) => acc + p.price, 0);
    const orderId = generateId("ord");
    const orderNumber = `NX-${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Create Order in Database
    const order = await orderRepository.create({
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
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: input.buyer.id,
      actorType: "user",
      action: "order.created",
      targetId: orderId,
      targetType: "order",
      details: { orderNumber, totalAmount },
    });

    // 2. Payment State Machine Initiation & Completion
    const paymentId = generateId("pay");
    const payment = await paymentRepository.create({
      id: paymentId,
      orderId,
      amount: totalAmount,
      currency: "USD",
      provider: input.paymentProvider || "mock",
      providerTransactionId: "txn_" + generateId("ses"),
      status: "completed",
    });

    await orderRepository.updateStatus(orderId, "completed");
    order.status = "completed";

    // 3. Append-Only Financial Ledger (Double-Entry)
    const platformFee = Math.round(totalAmount * 0.07);
    const sellerEarnings = totalAmount - platformFee;

    const ledgerEntries = await ledgerRepository.append([
      {
        id: generateId("ldg"),
        accountId: `user:${input.buyer.id}`,
        amount: -totalAmount,
        currency: "USD",
        referenceType: "order",
        referenceId: orderId,
        balanceAfter: 0,
        description: `Purchase of order ${orderNumber}`,
      },
      {
        id: generateId("ldg"),
        accountId: `developer:${products[0]?.authorId || "nexus"}`,
        amount: sellerEarnings,
        currency: "USD",
        referenceType: "order",
        referenceId: orderId,
        balanceAfter: sellerEarnings,
        description: `Payout for order ${orderNumber}`,
      },
      {
        id: generateId("ldg"),
        accountId: "platform:nexus",
        amount: platformFee,
        currency: "USD",
        referenceType: "fee",
        referenceId: orderId,
        balanceAfter: platformFee,
        description: `Platform fee for order ${orderNumber}`,
      },
    ]);

    // 4. Provision Licenses and Entitlements
    const issuedLicenses: License[] = [];
    for (const prod of products) {
      await productRepository.update(prod.id, { salesCount: prod.salesCount + 1 });

      const licenseKey = `NX-${prod.type.slice(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const license = await licenseRepository.create({
        id: generateId("lic"),
        key: licenseKey,
        productId: prod.id,
        userId: input.buyer.id,
        serverId: input.serverId,
        model: prod.licenseModel,
        status: "active",
        entitlements: ["server.run", "updates.download", "support.priority"],
      });

      // Create explicit Entitlements
      await entitlementRepository.create({
        id: generateId("ent"),
        subjectType: "user",
        subjectId: input.buyer.id,
        permission: "product.download",
        resourceId: prod.id,
      });

      if (input.serverId) {
        await entitlementRepository.create({
          id: generateId("ent"),
          subjectType: "server",
          subjectId: input.serverId,
          permission: "server.run",
          resourceId: prod.id,
        });
      }

      issuedLicenses.push(license);

      await auditRepository.record({
        id: generateId("aud"),
        actorId: input.buyer.id,
        actorType: "user",
        action: "license.issued",
        targetId: license.id,
        targetType: "license",
        details: { key: license.key, productId: prod.id },
      });

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
    return licenseRepository.listByUser(userId);
  }

  async verifyLicense(key: string, serverId?: string): Promise<{ valid: boolean; license?: License; reason?: string }> {
    const license = await licenseRepository.findByKey(key);
    if (!license) return { valid: false, reason: "Invalid license key" };
    if (license.status !== "active") return { valid: false, reason: `License is ${license.status}` };
    if (license.expiresAt && license.expiresAt < new Date()) return { valid: false, reason: "License has expired" };
    if (license.serverId && serverId && license.serverId !== serverId) {
      return { valid: false, reason: "License is locked to a different server identity" };
    }

    return { valid: true, license };
  }

  async checkEntitlement(
    subject: { type: "user" | "server" | "organization"; id: string },
    resourceId: string,
    permission: string
  ): Promise<boolean> {
    return entitlementRepository.hasEntitlement(subject, resourceId, permission);
  }
}

export const commerceService = new CommerceService();
