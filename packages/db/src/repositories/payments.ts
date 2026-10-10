import { eq } from "drizzle-orm";
import { db } from "../client";
import { orders, payments } from "../schema";
import type { Payment } from "@nexus/domain";
import { AppError } from "@nexus/domain";

export class PaymentRepository {
  async findByOrderId(orderId: string): Promise<Payment | null> {
    const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
    return (rows[0] as unknown as Payment) || null;
  }

  async create(data: Omit<Payment, "createdAt" | "updatedAt">): Promise<Payment> {
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
    await db
      .update(payments)
      .set({ status, failureReason, updatedAt: new Date() })
      .where(eq(payments.id, id));
  }
}

export const paymentRepository = new PaymentRepository();
