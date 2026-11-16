import { randomUUID } from "node:crypto";
import {
  ForbiddenError,
  LICENSE_EXPIRING_DAYS,
  LICENSE_MAINTENANCE_BATCH_LIMIT,
  type LicenseMaintenanceResult,
} from "@nexus/domain";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  licenseRuntimeBindings as bindings,
  licenseTermEvents as events,
  licenses,
  notificationPreferences,
  notifications,
  products,
  users,
} from "../schema";
import { historyPageBounds } from "./history-pagination";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

function pendingTerm() {
  return sql`isfinite(${licenses.expiresAt}) AND (
    (${licenses.status} IN ('active','suspended','expired') AND ${licenses.expiresAt} <= clock_timestamp()
      AND NOT EXISTS (SELECT 1 FROM ${events} WHERE ${events.licenseId} = ${licenses.id}
        AND ${events.expiresAt} = ${licenses.expiresAt} AND ${events.event} = 'expired'))
    OR (${licenses.status} = 'active' AND ${licenses.expiresAt} > clock_timestamp()
      AND ${licenses.expiresAt} <= clock_timestamp() + ${LICENSE_EXPIRING_DAYS} * interval '1 day'
      AND NOT EXISTS (SELECT 1 FROM ${events} WHERE ${events.licenseId} = ${licenses.id}
        AND ${events.expiresAt} = ${licenses.expiresAt} AND ${events.event} = 'expiring'))
  )`;
}

export class LicenseMaintenanceRepository {
  /** Operator view only; no buyer identifiers, keys, digests or server addresses. */
  async preview(actorId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const [actor] = await tx
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, actorId))
          .for("share")
          .limit(1);
        if (actor?.role !== "admin") throw new ForbiddenError();
        const [summary] = await tx
          .select({
            total: count(),
            expired: sql<number>`count(*) filter (where ${licenses.expiresAt} <= clock_timestamp())::integer`,
            expiring: sql<number>`count(*) filter (where ${licenses.expiresAt} > clock_timestamp())::integer`,
          })
          .from(licenses)
          .where(pendingTerm());
        const [unknown] = await tx
          .select({ total: count() })
          .from(licenses)
          .where(
            and(
              inArray(licenses.status, ["active", "suspended"]),
              sql`coalesce(isfinite(${licenses.expiresAt}), false) = false`,
            ),
          );
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const items = await tx
          .select({
            id: licenses.id,
            productTitle: products.title,
            status: licenses.status,
            expiresAt: licenses.expiresAt,
            event: sql<
              "expired" | "expiring"
            >`case when ${licenses.expiresAt} <= clock_timestamp() then 'expired' else 'expiring' end`,
          })
          .from(licenses)
          .innerJoin(products, eq(products.id, licenses.productId))
          .where(pendingTerm())
          .orderBy(asc(licenses.expiresAt), asc(licenses.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return {
          items,
          expired: summary?.expired ?? 0,
          expiring: summary?.expiring ?? 0,
          unknownTerms: unknown?.total ?? 0,
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }

  /** Trusted maintenance entry point, not a public issuance or renewal operation. */
  async runBatch(limit = 20, signal?: AbortSignal): Promise<LicenseMaintenanceResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > LICENSE_MAINTENANCE_BATCH_LIMIT)
      throw new RangeError("Invalid license maintenance batch");
    const result: LicenseMaintenanceResult = {
      processed: 0,
      expired: 0,
      warned: 0,
      inbox: 0,
      pushJobs: 0,
    };
    for (let index = 0; index < limit && !signal?.aborted; index++) {
      const processed = await db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '5s'`);
        await tx.execute(sql`set local statement_timeout = '10s'`);
        // One parent per transaction avoids cross-recipient lock inversion.
        // Other workers skip a parent that an owner/moderator already holds.
        const [license] = await tx
          .select({
            id: licenses.id,
            userId: licenses.userId,
            status: licenses.status,
            expiresAt: licenses.expiresAt,
          })
          .from(licenses)
          .where(pendingTerm())
          .orderBy(asc(licenses.expiresAt), asc(licenses.id))
          .for("no key update", { skipLocked: true })
          .limit(1);
        if (!license?.expiresAt) return null;
        const [clock] = await tx.execute(
          sql`select clock_timestamp()::text as now, ${licenses.expiresAt} <= clock_timestamp() as expired from ${licenses} where ${licenses.id} = ${license.id}`,
        );
        const now = new Date(String(clock.now)),
          event = clock.expired === true ? ("expired" as const) : ("expiring" as const);
        if (event === "expired") {
          if (license.status !== "expired")
            await tx
              .update(licenses)
              .set({ status: "expired", updatedAt: now })
              .where(eq(licenses.id, license.id));
          // Also clear unusable credentials on older already-expired records.
          await tx
            .update(bindings)
            .set({ tokenDigest: null, tokenIssuedAt: null, tokenExpiresAt: null, updatedAt: now })
            .where(eq(bindings.licenseId, license.id));
        }
        await lockNotificationPreferencesForUsers(tx, [license.userId]);
        const [preference] = await tx
          .select({ enabled: notificationPreferences.commerceEnabled })
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, license.userId))
          .limit(1);
        const notified = preference?.enabled !== false;
        await tx.insert(events).values({
          licenseId: license.id,
          event,
          expiresAt: sql`(select ${licenses.expiresAt} from ${licenses} where ${licenses.id} = ${license.id})`,
          notified,
          createdAt: now,
        });
        await tx.insert(auditEvents).values({
          id: `aud_${randomUUID()}`,
          actorId: "system:license-maintenance",
          actorType: "system",
          action: event === "expired" ? "license.expired" : "license.expiring",
          targetType: "license",
          targetId: license.id,
          details: {
            userId: license.userId,
            previousStatus: license.status,
            status: event === "expired" ? "expired" : license.status,
            expiresAt: license.expiresAt.toISOString(),
            termChanged: false,
            notified,
          },
          createdAt: now,
        });
        let pushJobs = 0;
        if (notified) {
          const notificationId = `ntf_${randomUUID()}`;
          await tx.insert(notifications).values({
            id: notificationId,
            recipientId: license.userId,
            type: "license",
            category: "commerce",
            title:
              event === "expired"
                ? "License expired / Срок лицензии истёк"
                : "License expires soon / Лицензия скоро истечёт",
            message: `UTC: ${license.expiresAt.toISOString()}`,
            link: `/workspace/licenses/${encodeURIComponent(license.id)}`,
            data: { kind: "license_term", event, expiresAt: license.expiresAt.toISOString() },
            isRead: false,
            createdAt: now,
          });
          pushJobs = (await enqueueWebPushWithRecoveryWithin(tx, notificationId, license.userId))
            .queued;
        }
        return { event, notified, pushJobs };
      });
      if (!processed) break;
      result.processed++;
      if (processed.event === "expired") result.expired++;
      else result.warned++;
      if (processed.notified) result.inbox++;
      result.pushJobs += processed.pushJobs;
    }
    return result;
  }
}
export const licenseMaintenanceRepository = new LicenseMaintenanceRepository();
