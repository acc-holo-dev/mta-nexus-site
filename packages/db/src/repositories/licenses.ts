import { and, asc, count, desc, eq, gt, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import { licenses, products, licenseRuntimeBindings } from "../schema";
import { historyPageBounds } from "./history-pagination";
import { LICENSE_EXPIRING_DAYS, type License, type LicenseArchiveFilter } from "@nexus/domain";
import { containsPattern } from "./search-pattern";

export class LicenseRepository {
  async listActiveDownloadableByUser(
    userId: string,
  ): Promise<Array<Pick<License, "productId" | "createdAt">>> {
    const rows = await db
      .select({
        productId: licenses.productId,
        createdAt: licenses.createdAt,
      })
      .from(licenses)
      .where(
        and(
          eq(licenses.userId, userId),
          eq(licenses.status, "active"),
          or(isNull(licenses.expiresAt), gt(licenses.expiresAt, new Date())),
        ),
      );
    return rows;
  }

  /**
   * Bounded, user-scoped legacy license archive. Deliberately exclude the
   * secret license key, entitlement JSON, server ID and account metadata.
   */
  async pageUserHistory(userId: string, requestedPage = 1, filter?: LicenseArchiveFilter) {
    return db.transaction(
      async (tx) => {
        const bound = sql<boolean>`${licenses.serverId} IS NOT NULL OR EXISTS (SELECT 1 FROM ${licenseRuntimeBindings} WHERE ${licenseRuntimeBindings.licenseId} = ${licenses.id})`;
        const effectiveStatus = sql<string>`case when ${licenses.status} IN ('active','suspended') AND isfinite(${licenses.expiresAt}) AND ${licenses.expiresAt} <= clock_timestamp() then 'expired' else ${licenses.status} end`;
        const scope = and(
          eq(licenses.userId, userId),
          filter?.status === "expiring"
            ? and(
                eq(licenses.status, "active"),
                sql`isfinite(${licenses.expiresAt}) AND ${licenses.expiresAt} > clock_timestamp() AND ${licenses.expiresAt} <= clock_timestamp() + ${LICENSE_EXPIRING_DAYS} * interval '1 day'`,
              )
            : filter && filter.status !== "all"
              ? sql`${effectiveStatus} = ${filter.status}`
              : undefined,
          filter?.binding === "bound"
            ? sql`(${bound})`
            : filter?.binding === "unbound"
              ? sql`NOT (${bound})`
              : undefined,
          filter?.term === "finite"
            ? sql`isfinite(${licenses.expiresAt})`
            : filter?.term === "unknown"
              ? sql`coalesce(isfinite(${licenses.expiresAt}), false) = false`
              : undefined,
          filter?.q
            ? or(
                ilike(licenses.id, containsPattern(filter.q)),
                ilike(products.title, containsPattern(filter.q)),
              )
            : undefined,
        );
        const [summary] = await tx
          .select({ total: count() })
          .from(licenses)
          .innerJoin(products, eq(products.id, licenses.productId))
          .where(scope);
        const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
        const rows = await tx
          .select({
            id: licenses.id,
            productTitle: products.title,
            status: licenses.status,
            effectiveStatus,
            model: licenses.model,
            expiresAt:
              sql<Date | null>`case when isfinite(${licenses.expiresAt}) then ${licenses.expiresAt} else null end`.mapWith(
                licenses.expiresAt,
              ),
            createdAt: licenses.createdAt,
            serverBound: bound,
          })
          .from(licenses)
          .innerJoin(products, eq(licenses.productId, products.id))
          .where(scope)
          .orderBy(
            ...(filter?.sort === "expires_soon"
              ? [
                  sql`case when isfinite(${licenses.expiresAt}) then ${licenses.expiresAt} else null end asc nulls last`,
                  asc(licenses.id),
                ]
              : [desc(licenses.createdAt), desc(licenses.id)]),
          )
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { licenses: rows, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async findByKey(key: string): Promise<License | null> {
    const rows = await db.select().from(licenses).where(eq(licenses.key, key)).limit(1);
    return (rows[0] as unknown as License) || null;
  }

  async listByUser(userId: string): Promise<License[]> {
    const rows = await db.select().from(licenses).where(eq(licenses.userId, userId));
    return rows as unknown as License[];
  }

  async listAll(): Promise<License[]> {
    const rows = await db.select().from(licenses);
    return rows as unknown as License[];
  }

  async create(data: Omit<License, "createdAt" | "updatedAt">): Promise<License> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const rows = await db.insert(licenses).values(values).returning();
    return rows[0] as unknown as License;
  }

  async updateStatus(id: string, status: License["status"]): Promise<void> {
    await db.update(licenses).set({ status, updatedAt: new Date() }).where(eq(licenses.id, id));
  }
}

export const licenseRepository = new LicenseRepository();
