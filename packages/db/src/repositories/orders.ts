import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import {
  orders,
  orderItems,
  products,
  builds,
  entitlements,
  licenses,
  users,
  auditEvents,
} from "../schema";
import {
  AppError,
  readOrderLineTerms,
  validatePendingOrder,
  type Order,
  type OrderItem,
} from "@nexus/domain";
import { createHash } from "node:crypto";
import { historyPageBounds } from "./history-pagination";
import { safePublishedBuildCondition, trustedCleanScanCondition } from "./build-safety";

export class OrderRepository {
  /** Buyer-scoped receipt: historical line prices and current access are separate. */
  async buyerDetails(orderId: string, buyerId: string, requestedPage = 1) {
    return db.transaction(
      async (tx) => {
        const [order] = await tx
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status,
            totalAmount: orders.totalAmount,
            currency: orders.currency,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
          })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.buyerId, buyerId)))
          .limit(1);
        if (!order) return null;
        const [summary] = await tx
          .select({ total: count() })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));
        const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
        const now = new Date();
        const available = sql<boolean>`(${products.status} = 'published'
        and exists (select 1 from ${builds} where ${builds.productId} = ${products.id}
          and ${builds.status} = 'published' and ${trustedCleanScanCondition()}))`;
        const currentAccess = sql<boolean>`(${available} and (
        exists (select 1 from ${entitlements} where ${entitlements.subjectType} = 'user'
          and ${entitlements.subjectId} = ${buyerId} and ${entitlements.resourceId} = ${products.id}
          and ${entitlements.permission} = 'product.download'
          and (${entitlements.expiresAt} is null or ${entitlements.expiresAt} > ${now}))
        or exists (select 1 from ${licenses} where ${licenses.userId} = ${buyerId}
          and ${licenses.productId} = ${products.id} and ${licenses.status} = 'active'
          and (${licenses.expiresAt} is null or ${licenses.expiresAt} > ${now}))))`;
        const items = await tx
          .select({
            id: orderItems.id,
            productId: orderItems.productId,
            unitPrice: orderItems.unitPrice,
            currency: orderItems.currency,
            productTitle: sql<
              string | null
            >`case when (${currentAccess} or (${available} and ${products.price} = 0)) then ${products.title} else null end`,
            productSlug: sql<
              string | null
            >`case when (${available} and ${products.price} = 0) then ${products.slug} else null end`,
            hasCurrentAccess: sql<boolean>`coalesce(${currentAccess}, false)`,
          })
          .from(orderItems)
          .innerJoin(products, eq(products.id, orderItems.productId))
          .where(eq(orderItems.orderId, order.id))
          .orderBy(asc(orderItems.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { order, items, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

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
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalAmount: orders.totalAmount,
        currency: orders.currency,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(scope)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(bounds.pageSize)
      .offset(bounds.offset);
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
      isNull(products.organizationId),
      eq(orders.status, "completed"),
    );
    const [summary] = await db
      .select({ total: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(scope);
    const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
    const rows = await db
      .select({
        id: orderItems.id,
        orderNumber: orders.orderNumber,
        productTitle: products.title,
        unitPrice: orderItems.unitPrice,
        currency: orderItems.currency,
        createdAt: orders.createdAt,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(scope)
      .orderBy(desc(orders.createdAt), desc(orderItems.id))
      .limit(bounds.pageSize)
      .offset(bounds.offset);
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
    const items = validatePendingOrder(order);
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

    const committed = await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`order-create:${order.id}`}))`);
      const [existing] = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          buyerId: orders.buyerId,
          status: orders.status,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt,
        })
        .from(orders)
        .where(eq(orders.id, order.id))
        .limit(1)
        .for("no key update");
      if (existing) {
        if (
          existing.buyerId !== order.buyerId ||
          existing.orderNumber !== order.orderNumber ||
          existing.currency !== order.currency ||
          existing.totalAmount !== order.totalAmount
        )
          throw new AppError("Order request changed", 409, "ORDER_REQUEST_CONFLICT");
        if (existing.status !== "pending")
          throw new AppError("Order state changed", 409, "ORDER_STATE_CHANGED");
        const [buyer] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, order.buyerId))
          .limit(1)
          .for("share");
        if (!buyer) throw new AppError("Buyer unavailable", 404, "NOT_FOUND");
        const previous = await tx
          .select({
            id: orderItems.id,
            productId: orderItems.productId,
            unitPrice: orderItems.unitPrice,
            currency: orderItems.currency,
            snapshot: orderItems.commercialSnapshot,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id))
          .orderBy(asc(orderItems.productId));
        if (
          previous.length !== items.length ||
          previous.some(
            (line) =>
              !items.some(
                (item) =>
                  item.id === line.id &&
                  item.productId === line.productId &&
                  item.unitPrice === line.unitPrice &&
                  item.currency === line.currency,
              ),
          )
        )
          throw new AppError("Order request changed", 409, "ORDER_REQUEST_CONFLICT");
        if (
          previous.some((line) => {
            const terms = readOrderLineTerms(line.snapshot);
            return (
              !terms ||
              terms.product.id !== line.productId ||
              terms.line.unitPrice !== line.unitPrice ||
              terms.line.currency !== line.currency
            );
          })
        )
          throw new AppError("Legacy order terms are unknown", 409, "ORDER_TERMS_UNKNOWN");
        return existing;
      }
      const resources = await tx
        .select({
          id: products.id,
          status: products.status,
          price: products.price,
          currency: products.currency,
          licenseModel: products.licenseModel,
        })
        .from(products)
        .where(
          inArray(
            products.id,
            items.map((item) => item.productId),
          ),
        )
        .orderBy(asc(products.id))
        .for("share");
      if (
        resources.length !== items.length ||
        resources.some((resource) => {
          const item = items.find((line) => line.productId === resource.id);
          return (
            !item ||
            resource.status !== "published" ||
            resource.price !== item.unitPrice ||
            resource.currency !== item.currency ||
            (resource.price > 0 && resource.licenseModel !== "single_server")
          );
        })
      )
        throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
      const [buyer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, order.buyerId))
        .limit(1)
        .for("share");
      if (!buyer) throw new AppError("Buyer unavailable", 404, "NOT_FOUND");
      for (const item of items) {
        const [safe] = await tx
          .select({ id: builds.id })
          .from(builds)
          .where(safePublishedBuildCondition(item.productId))
          .orderBy(desc(builds.createdAt), desc(builds.id))
          .limit(1)
          .for("share");
        if (!safe)
          throw new AppError("Published release unavailable", 409, "ORDER_CATALOG_CHANGED");
      }
      await tx.insert(orders).values(values);
      for (const item of items) {
        await tx.insert(orderItems).values({
          id: item.id,
          orderId: order.id,
          productId: item.productId,
          unitPrice: item.unitPrice,
          currency: item.currency,
        });
      }
      await tx.insert(auditEvents).values({
        id: `aud_order_${createHash("sha256").update(order.id).digest("hex")}`,
        actorId: order.buyerId,
        actorType: "user",
        action: "order.terms_recorded",
        targetId: order.id,
        targetType: "order",
        details: {
          snapshotVersion: 1,
          itemCount: items.length,
          totalAmount: order.totalAmount,
          currency: order.currency,
        },
      });
      const [record] = await tx
        .select({ createdAt: orders.createdAt, updatedAt: orders.updatedAt })
        .from(orders)
        .where(eq(orders.id, order.id))
        .limit(1);
      if (!record) throw new AppError("Order could not be recorded", 409, "ORDER_TERMS_CHANGED");
      return record;
    });

    return { ...order, createdAt: committed.createdAt, updatedAt: committed.updatedAt };
  }

  async updateStatus(id: string, status: Order["status"]): Promise<void> {
    // Use the audited unpaid cancellation operation; future financial transitions
    // must be implemented by verified provider settlement, never this old primitive.
    void id;
    void status;
    throw new AppError(
      "An audited commercial operation is required",
      409,
      "ORDER_CONFIRMATION_REQUIRED",
    );
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
      .where(
        and(
          eq(products.authorId, sellerId),
          isNull(products.organizationId),
          eq(orders.status, "completed"),
        ),
      )
      .orderBy(desc(orders.createdAt), desc(orderItems.id))
      .limit(Number.isSafeInteger(limit) ? Math.max(1, Math.min(100, limit)) : 100);

    return rows;
  }
}

export const orderRepository = new OrderRepository();
