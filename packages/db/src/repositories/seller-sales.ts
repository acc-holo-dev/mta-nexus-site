import {
  NotFoundError,
  type SellerSale,
  type SellerSalesQuery,
  type SellerSalesReport,
  type SellerSalesTotal,
  sellerSalesWindow,
} from "@nexus/domain";
import { sql } from "drizzle-orm";
import { db } from "../client";
import {
  orderItems,
  orders,
  organizationMembers,
  organizations,
  payments,
  products,
} from "../schema";
import { lockFinancialAccountAuthority } from "./financial-statements";
import { historyPageBounds } from "./history-pagination";

function portfolio(actorId: string, organizationId?: string) {
  return organizationId
    ? sql`p.organization_id = ${organizationId}`
    : sql`p.author_id = ${actorId} AND p.organization_id IS NULL`;
}
/** Aggregate every payment attempt once per order; never multiply line values by attempts. */
function source(actorId: string, query: SellerSalesQuery, observedAt: Date) {
  const { cutoff } = sellerSalesWindow(query.days, observedAt);
  return sql`WITH scoped AS (
    SELECT i.id, i.product_id AS "productId", left(p.title,200) AS "productTitle",
      left(o.order_number,128) AS "orderNumber",o.status,i.unit_price AS "unitPrice",
      left(i.currency,16) AS currency,o.created_at AS "createdAt",o.id AS "orderId",
      CASE
        WHEN o.currency NOT IN ('USD','EUR','RUB') OR i.currency <> o.currency OR i.unit_price < 0
          OR o.total_amount < 0 OR i.unit_price > o.total_amount OR pay.mismatch THEN 'review'
        WHEN o.total_amount = 0 THEN CASE WHEN i.unit_price = 0 AND pay.attempts = 0 AND o.status = 'completed' THEN 'free' ELSE 'review' END
        WHEN pay.captures <> 1 THEN 'review'
        WHEN pay.disputes = 1 THEN 'dispute_recorded'
        WHEN pay.refunds = 1 THEN 'refund_recorded'
        WHEN pay.completed = 1 AND o.status = 'completed' THEN 'capture_recorded'
        ELSE 'review' END AS evidence
    FROM ${orderItems} i INNER JOIN ${orders} o ON o.id = i.order_id
    INNER JOIN ${products} p ON p.id = i.product_id
    CROSS JOIN LATERAL (SELECT count(*)::int AS attempts,
      count(*) FILTER (WHERE status IN ('completed','refunded','partially_refunded','disputed'))::int AS captures,
      count(*) FILTER (WHERE status = 'completed')::int AS completed,
      count(*) FILTER (WHERE status IN ('refunded','partially_refunded'))::int AS refunds,
      count(*) FILTER (WHERE status = 'disputed')::int AS disputes,
      coalesce(bool_or(amount <> o.total_amount OR currency <> o.currency),false) AS mismatch
      FROM ${payments} WHERE order_id = o.id) pay
    WHERE ${portfolio(actorId, query.organizationId)} AND o.status IN ('completed','refunded')
      AND (${query.status} = 'all' OR o.status = ${query.status})
      AND (${cutoff}::timestamptz IS NULL OR o.created_at >= ${cutoff})
      AND o.created_at <= ${observedAt}
      ${query.currency ? sql`AND i.currency = ${query.currency}` : sql``}
      ${query.productId ? sql`AND p.id = ${query.productId}` : sql``}
  ), filtered AS (SELECT * FROM scoped WHERE ${query.evidence} = 'all' OR evidence = ${query.evidence})`;
}
const saleProjection = sql`id,"productId","productTitle","orderNumber",status,"unitPrice",currency,"createdAt",evidence`;
const currencyGroup = sql`CASE WHEN currency IN ('USD','EUR','RUB') THEN currency ELSE 'OTHER' END`;
type SaleRow = Omit<SellerSale, "createdAt"> & { createdAt: string | Date };
function projectSale(row: SaleRow): SellerSale {
  // Drizzle leaves raw execute() timestamp parsing transparent; decode at this boundary.
  const createdAt = new Date(
    row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
  );
  if (!Number.isFinite(createdAt.getTime())) throw new RangeError("Invalid recorded sales date");
  return {
    id: row.id,
    productId: row.productId,
    productTitle: row.productTitle,
    orderNumber: row.orderNumber,
    status: row.status,
    unitPrice: row.unitPrice,
    currency: row.currency,
    createdAt,
    evidence: row.evidence,
  };
}
export class SellerSalesRepository {
  async scopes(actorId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        await lockFinancialAccountAuthority(tx, actorId);
        const condition = sql`${organizations.ownerId} = ${actorId} OR EXISTS (SELECT 1 FROM ${organizationMembers} WHERE ${organizationMembers.organizationId} = ${organizations.id} AND ${organizationMembers.userId} = ${actorId} AND ${organizationMembers.role} IN ('owner','admin'))`;
        const [count] = await tx.execute<{ total: number }>(
          sql`SELECT count(*)::int AS total FROM ${organizations} WHERE ${condition}`,
        );
        const bounds = historyPageBounds(Number(count?.total ?? 0), page);
        const scopes = await tx
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(condition)
          .orderBy(organizations.name, organizations.id)
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { scopes, ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async report(actorId: string, query: SellerSalesQuery): Promise<SellerSalesReport> {
    return db.transaction(
      async (tx) => {
        await tx.execute(sql`set local statement_timeout = '10s'`);
        await tx.execute(sql`set local lock_timeout = '5s'`);
        const scope = await lockFinancialAccountAuthority(tx, actorId, query.organizationId);
        const [product] = query.productId
          ? await tx.execute<{ id: string; title: string }>(
              sql`SELECT p.id,left(p.title,200) AS title FROM ${products} p WHERE p.id = ${query.productId} AND ${portfolio(actorId, query.organizationId)}`,
            )
          : [];
        if (query.productId && !product) throw new NotFoundError("Sales resource", query.productId);
        const observedAt = new Date(),
          cte = source(actorId, query, observedAt);
        const totals = await tx.execute<SellerSalesTotal>(sql`${cte}
        SELECT ${currencyGroup} AS currency,count(*)::int AS lines,count(DISTINCT "orderId")::int AS orders,
          CASE WHEN currency IN ('USD','EUR','RUB') THEN sum("unitPrice")::text ELSE NULL END AS gross,
          count(*) FILTER (WHERE evidence = 'review')::int AS "reviewLines"
        FROM filtered GROUP BY ${currencyGroup},currency IN ('USD','EUR','RUB') ORDER BY 1`);
        const bounds = historyPageBounds(
          totals.reduce((n, row) => n + Number(row.lines), 0),
          query.page,
        );
        const saleRows = await tx.execute<SaleRow>(
          sql`${cte} SELECT ${saleProjection} FROM filtered ORDER BY "createdAt" DESC,id DESC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`,
        );
        const { periodUnit, periodStart } = sellerSalesWindow(query.days, observedAt);
        const periods = await tx.execute<SellerSalesReport["periods"][number]>(sql`${cte}
        SELECT to_char(date_trunc(${periodUnit},"createdAt" AT TIME ZONE 'UTC'),'YYYY-MM-DD') AS period,
          ${currencyGroup} AS currency,count(*)::int AS lines,
          CASE WHEN currency IN ('USD','EUR','RUB') THEN sum("unitPrice")::text ELSE NULL END AS gross
        FROM filtered WHERE "createdAt" >= ${periodStart}
        GROUP BY 1,${currencyGroup},currency IN ('USD','EUR','RUB') ORDER BY 1 DESC,2 LIMIT 128`);
        return {
          scope,
          product: product ?? null,
          observedAt,
          totals,
          sales: saleRows.map(projectSale),
          periods,
          periodUnit,
          periodStart,
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async detail(actorId: string, itemId: string, organizationId?: string) {
    return db.transaction(
      async (tx) => {
        await tx.execute(sql`set local statement_timeout = '10s'`);
        await tx.execute(sql`set local lock_timeout = '5s'`);
        const scope = await lockFinancialAccountAuthority(tx, actorId, organizationId),
          observedAt = new Date();
        const cte = source(
          actorId,
          { page: 1, days: "all", status: "all", evidence: "all", organizationId },
          observedAt,
        );
        const [sale] = await tx.execute<SaleRow>(
          sql`${cte} SELECT ${saleProjection} FROM filtered WHERE id = ${itemId} LIMIT 1`,
        );
        if (!sale) throw new NotFoundError("Sale line", itemId);
        return { scope, observedAt, sale: projectSale(sale) };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const sellerSalesRepository = new SellerSalesRepository();
