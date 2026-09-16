import { eq } from "drizzle-orm";
import { db } from "../client";
import { payments } from "../schema";
import type { Payment } from "@nexus/domain";

export class PaymentRepository {
  async findByOrderId(orderId: string): Promise<Payment | null> {
    try {
      const rows = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
      return (rows[0] as unknown as Payment) || null;
    } catch {
      return null;
    }
  }

  async create(data: Omit<Payment, "createdAt" | "updatedAt">): Promise<Payment> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const rows = await db.insert(payments).values(values).returning();
      return rows[0] as unknown as Payment;
    } catch {
      return values as unknown as Payment;
    }
  }

  async updateStatus(id: string, status: Payment["status"], failureReason?: string): Promise<void> {
    try {
      await db
        .update(payments)
        .set({ status, failureReason, updatedAt: new Date() })
        .where(eq(payments.id, id));
    } catch {
      // ignore
    }
  }
}

export const paymentRepository = new PaymentRepository();
