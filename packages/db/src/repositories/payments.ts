import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { orders, payments } from "../schema";
import type { Payment } from "@nexus/domain";
import { AppError } from "@nexus/domain";

export class PaymentRepository {
  async findByOrderId(orderId: string): Promise<Payment | null> {
    const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt), desc(payments.id)).limit(1);
    return (rows[0] as unknown as Payment) || null;
  }

  async create(data: Omit<Payment, "createdAt" | "updatedAt">): Promise<Payment> {
    if (data.status !== "pending" || !Number.isSafeInteger(data.amount) || data.amount <= 0 || !["USD", "EUR", "RUB"].includes(data.currency) || !/^[A-Za-z0-9_-]{1,100}$/u.test(data.provider) || data.providerTransactionId)
      throw new AppError("New payment attempts must await provider confirmation", 409, "PAYMENT_CONFIRMATION_REQUIRED");
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          status: orders.status,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
        })
        .from(orders)
        .where(eq(orders.id, data.orderId))
        .limit(1)
        .for("no key update");
      if (
        !order ||
        (order.status !== "pending" && order.status !== "processing") ||
        data.amount !== order.totalAmount ||
        data.currency !== order.currency
      )
        throw new AppError("Order cannot accept this payment attempt", 409, "ORDER_NOT_PAYABLE");
      const rows = await tx.insert(payments).values(values).returning();
      return rows[0] as unknown as Payment;
    });
  }

  async updateStatus(id: string, status: Payment["status"], failureReason?: string): Promise<void> {
    if (status !== "failed" && status !== "cancelled") throw new AppError("Financial payment transitions require a provider integration", 409, "PAYMENT_CONFIRMATION_REQUIRED");
    if (failureReason && failureReason.length > 1000) throw new AppError("Failure reason is too long", 400, "PAYMENT_INVALID");
    await db.transaction(async tx => {
      const [reference] = await tx.select({ orderId: payments.orderId }).from(payments).where(eq(payments.id, id)).limit(1);
      if (!reference) throw new AppError("Payment not found", 404, "NOT_FOUND");
      await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, reference.orderId)).limit(1).for("no key update");
      const [payment] = await tx.select({ status: payments.status }).from(payments).where(and(eq(payments.id, id), eq(payments.orderId, reference.orderId))).limit(1).for("update");
      if (!payment) throw new AppError("Payment changed", 409, "PAYMENT_STATE_CHANGED");
      if (payment.status === status) return;
      if (payment.status !== "pending") throw new AppError("Financial payment transitions require reconciliation", 409, "PAYMENT_STATE_CHANGED");
      await tx.update(payments).set({ status, failureReason, updatedAt: new Date() }).where(eq(payments.id, id));
    });
  }
}

export const paymentRepository = new PaymentRepository();
