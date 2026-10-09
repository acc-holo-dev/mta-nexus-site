import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { orders, orderItems, products } from "../schema";
import type { Order, OrderItem } from "@nexus/domain";
import { historyPageBounds } from "./history-pagination";

export class OrderRepository {
  async findById(id: string): Promise<Order | null> {
    const orderRows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    if (!orderRows.length) return null;

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const order = orderRows[0] as unknown as Order;
    order.items = items as unknown as OrderItem[];
    return order;
  }

  /**
   * Read-only bounded order archive. Never select payment tokens, buyer email,
   * or other users' orders. This does not activate paid checkout.
   */
  async pageBuyerHistory(buyerId: string, requestedPage = 1) {
    const scope = eq(orders.buyerId, buyerId);
    const [summary] = await db.select({ total: count() }).from(orders).where(scope);
    const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
    const rows = await db.select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalAmount: orders.totalAmount,
      currency: orders.currency,
      createdAt: orders.createdAt,
    }).from(orders).where(scope)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(bounds.pageSize).offset(bounds.offset);
    return { orders: rows, ...bounds };
  }

  /**
   * Seller's own historical completed order lines. No buyer identity, payment
   * provider, payout data, or unrelated product appears in the projection.
   * A line is gross sales history, NOT proof of funds available to withdraw.
   */
  async pageSellerHistory(sellerId: string, requestedPage = 1) {
    const scope = and(
      eq(products.authorId, sellerId),
      eq(orders.status, "completed"),
    );
    const [summary] = await db.select({ total: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(scope);
    const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
    const rows = await db.select({
      id: orderItems.id,
      orderNumber: orders.orderNumber,
      productTitle: products.title,
      unitPrice: orderItems.unitPrice,
      currency: orderItems.currency,
      createdAt: orders.createdAt,
    }).from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(scope)
      .orderBy(desc(orders.createdAt), desc(orderItems.id))
      .limit(bounds.pageSize).offset(bounds.offset);
    return { sales: rows, ...bounds };
  }

  async listByUser(buyerId: string): Promise<Order[]> {
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.buyerId, buyerId))
      .orderBy(desc(orders.createdAt));
    return rows as unknown as Order[];
  }

  async listAll(): Promise<Order[]> {
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt));
    return rows as unknown as Order[];
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

    await db.transaction(async (tx) => {
      await tx.insert(orders).values(values);
      for (const item of order.items) {
        await tx.insert(orderItems).values({
          id: item.id,
          orderId: order.id,
          productId: item.productId,
          unitPrice: item.unitPrice,
          currency: item.currency,
        });
      }
    });

    return { ...order, createdAt: values.createdAt, updatedAt: values.updatedAt };
  }

  async updateStatus(id: string, status: Order["status"]): Promise<void> {
    await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id));
  }

  /**
   * Seller-side commerce history: all completed orders containing products
   * authored by the given seller, with buyer-privacy preserved.
   */
  async listSalesBySeller(sellerId: string, limit = 100) {
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
  }
}

export const orderRepository = new OrderRepository();
