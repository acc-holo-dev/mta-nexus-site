import { createHash } from "node:crypto";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import type { db } from "../client";
import {
  notificationPreferences,
  notifications,
  objectNotificationMutes,
  organizations,
  resourceQaThreadFollows,
  resourceQaThreads,
} from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ResourceQaNoticeKind = "asked" | "answered" | "resolved" | "removed";

type ProductRef = {
  id: string;
  title: string;
  slug: string;
  authorId: string;
  organizationId: string | null;
};

function noticeId(parts: readonly unknown[]) {
  return `ntf_rqa_${createHash("sha256").update(JSON.stringify(parts)).digest("hex")}`;
}

function copyFor(kind: ResourceQaNoticeKind, productTitle: string) {
  switch (kind) {
    case "asked":
      return {
        title: "New resource question",
        message: `Someone asked about ${productTitle}.`,
      };
    case "answered":
      return {
        title: "Resource question answered",
        message: `There is a new answer for a question on ${productTitle}.`,
      };
    case "resolved":
      return {
        title: "Resource question resolved",
        message: `A useful answer was marked for a question on ${productTitle}.`,
      };
    case "removed":
      return {
        title: "Resource question removed",
        message: `A question on ${productTitle} was removed by staff or the publisher.`,
      };
  }
}

async function deliver(
  tx: Transaction,
  input: {
    kind: ResourceQaNoticeKind;
    product: ProductRef;
    threadId: string;
    recipientId: string;
    answerId?: string | null;
  },
) {
  await lockNotificationPreferencesForUsers(tx, [input.recipientId]);
  const [preference] = await tx
    .select({ enabled: notificationPreferences.contentEnabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, input.recipientId))
    .limit(1);
  if (preference?.enabled === false) return;

  // Active product mute suppresses Q&A content notices (same rule as content mutes).
  const [muted] = await tx
    .select({ id: objectNotificationMutes.id })
    .from(objectNotificationMutes)
    .where(
      and(
        eq(objectNotificationMutes.userId, input.recipientId),
        eq(objectNotificationMutes.targetType, "product"),
        eq(objectNotificationMutes.targetId, input.product.id),
        gt(objectNotificationMutes.mutedUntil, sql`clock_timestamp()`),
      ),
    )
    .limit(1);
  if (muted) return;

  const id = noticeId([
    input.kind,
    input.product.id,
    input.threadId,
    input.answerId ?? null,
    input.recipientId,
  ]);
  const text = copyFor(input.kind, input.product.title);
  const [inserted] = await tx
    .insert(notifications)
    .values({
      id,
      recipientId: input.recipientId,
      title: text.title,
      message: text.message,
      link: `/market/${encodeURIComponent(input.product.slug)}?qa=${encodeURIComponent(input.threadId)}#resource-qa`,
      type: "content",
      category: "content",
      isRead: false,
      data: {
        kind: "resource_qa",
        event: input.kind,
        productId: input.product.id,
        productTitle: input.product.title,
        threadId: input.threadId,
        answerId: input.answerId ?? null,
      },
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!inserted) return;

  const result = await enqueueWebPushWithRecoveryWithin(tx, id, input.recipientId);
  if (result.reason === "saturated" || result.reason === "error")
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "resource_qa",
        kind: input.kind,
        reason: result.reason,
      }),
    );
}

async function recipientsForAsk(tx: Transaction, product: ProductRef, actorId: string) {
  const recipients = new Set<string>();
  if (product.authorId !== actorId) recipients.add(product.authorId);
  if (product.organizationId) {
    const [organization] = await tx
      .select({ ownerId: organizations.ownerId })
      .from(organizations)
      .where(eq(organizations.id, product.organizationId))
      .limit(1)
      .for("share");
    if (organization?.ownerId && organization.ownerId !== actorId)
      recipients.add(organization.ownerId);
  }
  return [...recipients];
}

async function recipientsForThreadAudience(tx: Transaction, threadId: string, actorId: string) {
  const recipients = new Set<string>();
  const [thread] = await tx
    .select({ authorId: resourceQaThreads.authorId })
    .from(resourceQaThreads)
    .where(eq(resourceQaThreads.id, threadId))
    .limit(1)
    .for("share");
  if (thread?.authorId && thread.authorId !== actorId) recipients.add(thread.authorId);

  const followers = await tx
    .select({ userId: resourceQaThreadFollows.userId })
    .from(resourceQaThreadFollows)
    .where(
      and(
        eq(resourceQaThreadFollows.threadId, threadId),
        eq(resourceQaThreadFollows.enabled, true),
        ne(resourceQaThreadFollows.userId, actorId),
      ),
    );
  for (const follower of followers) recipients.add(follower.userId);
  return [...recipients];
}

/** Transactional inbox for resource Q&A. Push degradation never rolls back the Q&A write. */
export async function notifyResourceQaEvent(
  tx: Transaction,
  input: {
    kind: ResourceQaNoticeKind;
    product: ProductRef;
    threadId: string;
    actorId: string;
    answerId?: string | null;
  },
) {
  const recipients =
    input.kind === "asked"
      ? await recipientsForAsk(tx, input.product, input.actorId)
      : await recipientsForThreadAudience(tx, input.threadId, input.actorId);

  for (const recipientId of recipients) {
    await deliver(tx, {
      kind: input.kind,
      product: input.product,
      threadId: input.threadId,
      recipientId,
      answerId: input.answerId ?? null,
    });
  }
}
