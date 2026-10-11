import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushOutboxForNotification } from "./web-push-outbox";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function discussionModerationNotice(
  tx: Transaction,
  input: { auditId: string; authorId: string; commentId: string; slug: string },
) {
  await lockNotificationPreferencesForUsers(tx, [input.authorId]);
  const [preference] = await tx
    .select({ enabled: notificationPreferences.contentEnabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, input.authorId))
    .limit(1);
  if (preference?.enabled === false) return;
  const id = `ntf_discussion_${createHash("sha256")
    .update(JSON.stringify([input.auditId, input.authorId]))
    .digest("hex")}`;
  const [inserted] = await tx
    .insert(notifications)
    .values({
      id,
      recipientId: input.authorId,
      title: "Discussion moderation",
      message: `Comment ${input.commentId}: removed.`,
      link: `/articles/${encodeURIComponent(input.slug)}#discussion`,
      type: "content",
      category: "content",
      isRead: false,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!inserted) return;
  try {
    const result = await tx.transaction((pushTx) =>
      enqueueWebPushOutboxForNotification(pushTx, id, input.authorId),
    );
    if (result.reason === "saturated")
      console.warn(
        JSON.stringify({
          event: "notification.push_outbox_degraded",
          producer: "discussion_moderation",
          reason: "saturated",
        }),
      );
  } catch {
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "discussion_moderation",
        reason: "error",
      }),
    );
  }
}
