import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function contentReactionNotice(
  tx: Transaction,
  item: { id: string; slug: string; authorId: string },
  actorId: string,
) {
  if (item.authorId === actorId) return;
  await lockNotificationPreferencesForUsers(tx, [item.authorId]);
  const [preference] = await tx
    .select({ enabled: notificationPreferences.contentEnabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, item.authorId))
    .limit(1);
  if (preference?.enabled === false) return;
  // One status-only notice per actor/publication, including remove-and-readd retries.
  const id = `ntf_reaction_${createHash("sha256")
    .update(JSON.stringify([item.id, actorId]))
    .digest("hex")}`;
  const [inserted] = await tx
    .insert(notifications)
    .values({
      id,
      recipientId: item.authorId,
      title: "Publication reaction",
      message: `Publication ${item.id}: reaction.`,
      link: `/articles/${encodeURIComponent(item.slug)}`,
      type: "content",
      category: "content",
      isRead: false,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!inserted) return;
  const result = await enqueueWebPushWithRecoveryWithin(tx, id, item.authorId);
  if (result.reason === "saturated" || result.reason === "error")
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "content_reaction",
        reason: result.reason,
      }),
    );
}
