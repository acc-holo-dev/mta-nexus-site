import { eq, desc } from "drizzle-orm";
import { db } from "../client";
import { orders, orderItems, products } from "../schema";
import type { Order, OrderItem } from "@nexus/domain";

export class OrderRepository {
  async findById(id: string): Promise<Order | null> {
    try {
      const orderRows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      if (!orderRows.length) return null;

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
      const order = orderRows[0] as unknown as Order;
      order.items = items as unknown as OrderItem[];
      return order;
    } catch {
      return null;
    }
  }

  async listByUser(buyerId: string): Promise<Order[]> {
    try {
      const rows = await db
        .select()
        .from(orders)
        .where(eq(orders.buyerId, buyerId))
        .orderBy(desc(orders.createdAt));
      return rows as unknown as Order[];
    } catch {
      return [];
    }
  }

  async listAll(): Promise<Order[]> {
    try {
      const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
      return rows as unknown as Order[];
    } catch {
      return [];
    }
  }

  async create(order: Omit<Order, "createdAt" | "updatedAt">): Promise<Order> {
    const values = {
      id: order.id,
      orderNumber: order.orderNumber,
      buyerId: order.buyerId,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await db.insert(orders).values(values);
      for (const item of order.items) {
        await db.insert(orderItems).values({
          id: item.id,
          orderId: order.id,
          productId: item.productId,
          unitPrice: item.unitPrice,
          currency: item.currency,
        });
      }
      return { ...order, createdAt: values.createdAt, updatedAt: values.updatedAt };
    } catch {
      return { ...order, createdAt: values.createdAt, updatedAt: values.updatedAt };
    }
  }

  async updateStatus(id: string, status: Order["status"]): Promise<void> {
    try {
      await db
        .update(orders)
        .set({ status, updatedAt: new Date() })
        .where(eq(orders.id, id));
    } catch {
      // ignore
    }
  }

  /**
   * Seller-side commerce history: all completed orders containing products
   * authored by the given seller, with buyer-privacy preserved.
   */
  async listSalesBySeller(sellerId: string, limit = 100) {
    try {
      const rows = await db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          orderStatus: orders.status,
          createdAt: orders.createdAt,
          productId: orderItems.productId,
          unitPrice: orderItems.unitPrice,
          currency: orderItems.currency,
          productTitle: products.title,
          productSlug: products.slug,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(products.authorId, sellerId))
        .orderBy(desc(orders.createdAt))
        .limit(limit);

      return rows.filter((r) => r.orderStatus === "completed");
    } catch {
      return [];
    }
  }
}

export const orderRepository = new OrderRepository();
