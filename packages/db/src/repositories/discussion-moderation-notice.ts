import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Author permalink for a moderated discussion row (survives public unavailability). */
function authorDiscussionHref(commentId: string) {
  return `/workspace/discussions/${encodeURIComponent(commentId)}`;
}

export async function discussionModerationNotice(
  tx: Transaction,
  input: {
    auditId: string;
    authorId: string;
    commentId: string;
  },
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
      link: authorDiscussionHref(input.commentId),
      type: "content",
      category: "content",
      isRead: false,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!inserted) return;
  const result = await enqueueWebPushWithRecoveryWithin(tx, id, input.authorId);
  if (result.reason === "saturated" || result.reason === "error")
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "discussion_moderation",
        reason: result.reason,
      }),
    );
}
