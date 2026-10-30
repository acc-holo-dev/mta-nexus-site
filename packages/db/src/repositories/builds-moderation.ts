import type { AuditEvent, Build } from "@nexus/domain";
import { AppError } from "@nexus/domain";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  builds,
  notificationPreferences,
  notifications,
  organizationMembers,
  organizations,
  products,
  resourceReleaseEvents,
  users,
} from "../schema";
import { safePublishedBuildCondition, trustedCleanScanCondition } from "./build-safety";
import { lockInitiatingSession } from "./initiating-session";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import {
  assertBuildModerationAuthority,
  assertProductMutationAuthority,
} from "./product-mutation-authority";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

export async function submitForReview(
  data: Omit<Build, "createdAt">,
  audit: Omit<AuditEvent, "createdAt">,
): Promise<Build> {
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select({
        id: products.id,
        status: products.status,
        authorId: products.authorId,
        organizationId: products.organizationId,
        metadataReviewRequired: products.metadataReviewRequired,
      })
      .from(products)
      .where(eq(products.id, data.productId))
      .limit(1)
      .for("no key update");
    if (!parent || parent.status === "archived" || parent.status === "suspended") {
      throw new AppError("Resource is withdrawn from publication", 409, "PRODUCT_STATE_CHANGED");
    }

    await assertProductMutationAuthority(tx, parent, audit.actorId);

    const createdAt = new Date();
    const rows = await tx
      .insert(builds)
      .values({ ...data, createdAt })
      .returning();
    const build = rows[0];

    const published = await tx
      .select({ id: builds.id })
      .from(builds)
      .where(safePublishedBuildCondition(data.productId))
      .limit(1);
    if (!published[0] || parent.metadataReviewRequired) {
      await tx
        .update(products)
        .set({
          currentVersion: data.version,
          status: "pending_review",
          updatedAt: createdAt,
        })
        .where(eq(products.id, data.productId));
    }

    await tx.insert(auditEvents).values({ ...audit, createdAt });
    return build as unknown as Build;
  });
}

export async function moderatePending(
  id: string,
  decision: "approve" | "reject",
  audit: Omit<AuditEvent, "createdAt">,
  expectedRevision: number,
  currentToken: string,
): Promise<Build | null> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new AppError("Observed build revision is required", 400, "BUILD_REVISION_REQUIRED");
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ productId: builds.productId })
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);
    if (!target) return null;
    const [parent] = await tx
      .select({
        id: products.id,
        status: products.status,
        authorId: products.authorId,
        organizationId: products.organizationId,
        metadataReviewRequired: products.metadataReviewRequired,
      })
      .from(products)
      .where(eq(products.id, target.productId))
      .limit(1)
      .for("no key update");
    if (!parent) return null;
    await assertBuildModerationAuthority(tx, audit.actorId);
    await lockInitiatingSession(tx, audit.actorId, currentToken);
    if (parent.status === "archived" || parent.status === "suspended") {
      throw new AppError("Resource is withdrawn from publication", 409, "PRODUCT_STATE_CHANGED");
    }

    const targetStatus = decision === "approve" ? "published" : "rejected";
    const reviewCondition =
      decision === "approve"
        ? and(
            eq(builds.id, id),
            eq(builds.status, "pending_review"),
            eq(builds.revision, expectedRevision),
            trustedCleanScanCondition(),
          )
        : and(
            eq(builds.id, id),
            eq(builds.status, "pending_review"),
            eq(builds.revision, expectedRevision),
          );

    const rows = await tx
      .update(builds)
      .set({ status: targetStatus })
      .where(reviewCondition)
      .returning();
    const reviewed = rows[0];
    if (!reviewed) return null;

    const lockedProduct = await tx
      .update(products)
      .set({ updatedAt: sql`${products.updatedAt}` })
      .where(eq(products.id, reviewed.productId))
      .returning({
        id: products.id,
        title: products.title,
        authorId: products.authorId,
        organizationId: products.organizationId,
      });
    if (!lockedProduct[0]) {
      throw new Error("Build product disappeared during moderation");
    }

    if (decision === "approve") {
      const latestPublished = await tx
        .select({
          id: builds.id,
          version: builds.version,
        })
        .from(builds)
        .where(safePublishedBuildCondition(reviewed.productId))
        .orderBy(desc(builds.createdAt), desc(builds.id))
        .limit(1);
      if (!latestPublished[0]) {
        throw new Error("Published build disappeared during moderation");
      }

      await tx
        .update(products)
        .set({
          currentVersion: latestPublished[0].version,
          status: "published",
          metadataReviewRequired: false,
          updatedAt: new Date(),
        })
        .where(eq(products.id, reviewed.productId));
    } else {
      const fallback = await tx
        .select({ version: builds.version })
        .from(builds)
        .where(and(safePublishedBuildCondition(reviewed.productId), ne(builds.id, reviewed.id)))
        .orderBy(desc(builds.createdAt), desc(builds.id))
        .limit(1);
      const pending = parent.metadataReviewRequired
        ? await tx
            .select({ version: builds.version })
            .from(builds)
            .where(
              and(eq(builds.productId, reviewed.productId), eq(builds.status, "pending_review")),
            )
            .orderBy(desc(builds.createdAt), desc(builds.id))
            .limit(1)
        : [];
      await tx
        .update(products)
        .set(
          fallback[0] && !parent.metadataReviewRequired
            ? { currentVersion: fallback[0].version, status: "published", updatedAt: new Date() }
            : pending[0]
              ? {
                  currentVersion: pending[0].version,
                  status: "pending_review",
                  updatedAt: new Date(),
                }
              : { status: "draft", updatedAt: new Date() },
        )
        .where(eq(products.id, reviewed.productId));
    }

    await tx.insert(auditEvents).values({ ...audit, createdAt: new Date() });
    const product = lockedProduct[0];
    const notes = typeof audit.details?.notes === "string" ? audit.details.notes : "";
    const title =
      decision === "approve" ? "Resource version approved" : "Resource version rejected";
    const data = {
      kind: "build_review",
      decision,
      resourceTitle: product.title,
      version: reviewed.version,
      notes,
    };
    // Resolve current recipients in SQL, without exposing notes to former owners.
    // Lock preference scopes first so a concurrent settings PATCH linearizes
    // before or after this moderation notification, never through a stale read.
    const preferenceRecipients = await tx.execute(sql`
      select ${users.id} as id
      from ${users}
      where (
        (${product.organizationId}::text is null and ${users.id} = ${product.authorId})
        or exists (select 1 from ${organizations}
          where ${organizations.id} = ${product.organizationId} and ${organizations.ownerId} = ${users.id})
        or exists (select 1 from ${organizationMembers}
          where ${organizationMembers.organizationId} = ${product.organizationId}
            and ${organizationMembers.userId} = ${users.id}
            and (${organizationMembers.role} in ('owner', 'admin')
              or ${organizationMembers.permissions} @> '["manage_products"]'::jsonb))
      )
      order by ${users.id}
    `);
    await lockNotificationPreferencesForUsers(
      tx,
      preferenceRecipients.map((row) => String(row.id)),
    );

    // The pending-state compare-and-set above makes a replay a no-op, including delivery.
    const notificationRows = await tx.execute(sql`
      insert into ${notifications} (id, recipient_id, title, message, link, type, category, is_read, data, created_at)
      select 'ntf_build_review_' || ${reviewed.id} || '_r' || ${reviewed.revision ?? expectedRevision + 1}::text || '_' || ${users.id}, ${users.id},
        ${title}, ${`${product.title} · ${reviewed.version}${notes ? `\n${notes}` : ""}`},
        ${`/workspace/resources/${product.id}`}, 'system', 'system', false, ${JSON.stringify(data)}::jsonb, now()
      from ${users}
      where (
        (${product.organizationId}::text is null and ${users.id} = ${product.authorId})
        or exists (select 1 from ${organizations}
          where ${organizations.id} = ${product.organizationId} and ${organizations.ownerId} = ${users.id})
        or exists (select 1 from ${organizationMembers}
          where ${organizationMembers.organizationId} = ${product.organizationId}
            and ${organizationMembers.userId} = ${users.id}
            and (${organizationMembers.role} in ('owner', 'admin')
              or ${organizationMembers.permissions} @> '["manage_products"]'::jsonb))
      ) and not exists (select 1 from ${notificationPreferences}
        where ${notificationPreferences.userId} = ${users.id}
          and ${notificationPreferences.systemEnabled} = false)
      returning id, recipient_id
    `);
    let pushQueued = 0;
    let pushQueueDegraded = 0;
    for (const row of notificationRows) {
      const queued = await enqueueWebPushWithRecoveryWithin(
        tx,
        String(row.id),
        String(row.recipient_id),
      );
      pushQueued += queued.queued;
      if (queued.reason === "saturated" || queued.reason === "error") {
        pushQueueDegraded += 1;
      }
    }
    if (pushQueueDegraded > 0) {
      console.warn(
        JSON.stringify({
          event: "notification.push_outbox_degraded",
          producer: "build_review",
          notifications: notificationRows.length,
          pushQueued,
          pushQueueDegraded,
        }),
      );
    }
    // Durable work for opted-in buyers; never fan out inside moderation. A
    // retained artifact reviewed again keeps its original event identity.
    if (decision === "approve")
      await tx
        .insert(resourceReleaseEvents)
        .values({
          productId: reviewed.productId,
          buildId: reviewed.id,
          version: reviewed.version,
          sha256Hash: reviewed.sha256Hash,
          fileSizeBytes: reviewed.fileSizeBytes,
        })
        .onConflictDoNothing({ target: resourceReleaseEvents.buildId });
    return reviewed as unknown as Build;
  });
}
