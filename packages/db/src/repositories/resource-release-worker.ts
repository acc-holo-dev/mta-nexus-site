import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { RESOURCE_RELEASE_WORKER_LIMIT, type ResourceReleaseWorkerResult } from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  builds,
  notificationPreferences,
  notifications,
  products,
  resourceReleaseEvents as events,
  resourceReleaseWatches as watches,
  users,
} from "../schema";
import { lockUserDownloadAccess } from "./entitlements";
import { safePublishedBuildCondition } from "./build-safety";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushOutboxForNotification } from "./web-push-outbox";
function pending() {
  return sql`exists (select 1 from ${events} where ${events.productId} = ${watches.productId} and ${events.sequence} > ${watches.lastSequence})`;
}
export class ResourceReleaseWorkerRepository {
  async runBatch(limit = 20, signal?: AbortSignal): Promise<ResourceReleaseWorkerResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > RESOURCE_RELEASE_WORKER_LIMIT)
      throw new RangeError("Invalid release worker batch");
    const result: ResourceReleaseWorkerResult = {
      examined: 0,
      processed: 0,
      notified: 0,
      skipped: 0,
      disabled: 0,
      pushJobs: 0,
      pushDegraded: 0,
    };
    const visited: { userId: string; productId: string }[] = [];
    for (let index = 0; index < limit && !signal?.aborted; index++) {
      const work = await db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '5s'`);
        await tx.execute(sql`set local statement_timeout = '10s'`);
        const exclude = visited.length
          ? sql`not (${sql.join(
              visited.map(
                (item) =>
                  sql`(${watches.userId} = ${item.userId} and ${watches.productId} = ${item.productId})`,
              ),
              sql` or `,
            )})`
          : sql`true`;
        const [candidate] = await tx
          .select({ userId: watches.userId, productId: watches.productId })
          .from(watches)
          .where(and(eq(watches.enabled, true), pending(), exclude))
          .orderBy(asc(watches.lastSequence), asc(watches.productId), asc(watches.userId))
          .limit(1);
        if (!candidate) return null;
        visited.push(candidate);
        // Acquire parent and account BEFORE the watch. Account/resource deletion
        // and enrollment follow this order. Locked scopes are skipped, not waited.
        const [product] = await tx
          .select({ id: products.id, title: products.title, status: products.status })
          .from(products)
          .where(eq(products.id, candidate.productId))
          .limit(1)
          .for("share", { skipLocked: true });
        if (!product) return { skipped: true, processed: false };
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, candidate.userId))
          .limit(1)
          .for("share", { skipLocked: true });
        if (!user) return { skipped: true, processed: false };
        const access = await lockUserDownloadAccess(tx, user.id, product.id);
        const [watch] = await tx
          .select({ revision: watches.revision, lastSequence: watches.lastSequence })
          .from(watches)
          .where(
            and(
              eq(watches.userId, user.id),
              eq(watches.productId, product.id),
              eq(watches.enabled, true),
              pending(),
            ),
          )
          .limit(1)
          .for("no key update", { skipLocked: true });
        if (!watch) return { skipped: true, processed: false };
        const [event] = await tx
          .select()
          .from(events)
          .where(and(eq(events.productId, product.id), gt(events.sequence, watch.lastSequence)))
          .orderBy(asc(events.sequence))
          .limit(1);
        if (!event) return { skipped: true, processed: false };
        const [build] =
          product.status === "published"
            ? await tx
                .select({ id: builds.id })
                .from(builds)
                .where(
                  and(
                    safePublishedBuildCondition(product.id),
                    eq(builds.id, event.buildId),
                    eq(builds.version, event.version),
                    eq(builds.sha256Hash, event.sha256Hash),
                    eq(builds.fileSizeBytes, event.fileSizeBytes),
                  ),
                )
                .limit(1)
                .for("share")
            : [];
        await lockNotificationPreferencesForUsers(tx, [user.id]);
        const [preference] = await tx
          .select({ enabled: notificationPreferences.commerceEnabled })
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, user.id))
          .limit(1);
        const accessLost =
          !access || Boolean(access.expiresAt && access.expiresAt.getTime() <= Date.now());
        const notified = !accessLost && Boolean(build) && preference?.enabled !== false;
        let pushJobs = 0,
          pushDegraded = 0;
        if (notified) {
          const notificationId = `ntf_release_${event.sequence}_${user.id}`;
          await tx.insert(notifications).values({
            id: notificationId,
            recipientId: user.id,
            type: "system",
            category: "commerce",
            title: "Resource version published / Опубликована версия ресурса",
            message: `${product.title} · ${event.version}`,
            link: `/workspace/library/${encodeURIComponent(product.id)}/versions`,
            data: {
              kind: "resource_release",
              resourceTitle: product.title,
              version: event.version,
            },
          });
          try {
            const queued = await tx.transaction((pushTx) =>
              enqueueWebPushOutboxForNotification(pushTx, notificationId, user.id),
            );
            pushJobs = queued.queued;
            if (queued.reason === "saturated") pushDegraded++;
          } catch {
            pushDegraded++;
          }
        }
        await tx
          .update(watches)
          .set({
            lastSequence: event.sequence,
            enabled: !accessLost,
            revision: accessLost ? watch.revision + 1 : watch.revision,
            updatedAt: new Date(),
          })
          .where(and(eq(watches.userId, user.id), eq(watches.productId, product.id)));
        await tx.insert(auditEvents).values({
          id: `aud_${randomUUID()}`,
          actorId: "system:resource-release",
          actorType: "system",
          action: "library.release_notice_processed",
          targetType: "resource_release_watch",
          targetId: `${user.id}:${product.id}`,
          details: {
            sequence: event.sequence.toString(),
            buildId: event.buildId,
            notified,
            accessLost,
            reason: accessLost
              ? "access_lost"
              : !build
                ? "release_unavailable"
                : preference?.enabled === false
                  ? "preference_disabled"
                  : "notified",
          },
        });
        return {
          processed: true,
          notified,
          disabled: accessLost,
          skipped: !notified,
          pushJobs,
          pushDegraded,
        };
      });
      if (!work) break;
      result.examined++;
      if (work.processed) result.processed++;
      if (work.skipped) result.skipped++;
      if (work.notified) result.notified++;
      if (work.disabled) result.disabled++;
      result.pushJobs += work.pushJobs ?? 0;
      result.pushDegraded += work.pushDegraded ?? 0;
    }
    return result;
  }
}
export const resourceReleaseWorkerRepository = new ResourceReleaseWorkerRepository();
