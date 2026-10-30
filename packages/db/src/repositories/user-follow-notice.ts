import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Same-TX follower inbox notice; preferences rechecked on write. */
export async function userFollowNotice(
  tx: Transaction,
  followId: string,
  recipientId: string,
  followerUsername: string,
) {
  await lockNotificationPreferencesForUsers(tx, [recipientId]);
  const [preference] = await tx
    .select({ enabled: notificationPreferences.followsEnabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, recipientId))
    .limit(1);
  if (preference?.enabled === false) return;
  const id = `ntf_follow_${createHash("sha256").update(JSON.stringify([followId])).digest("hex")}`;
  const [inserted] = await tx
    .insert(notifications)
    .values({
      id,
      recipientId,
      title: "New Follower",
      message: `@${followerUsername} started following your activity.`,
      link: `/users/${encodeURIComponent(followerUsername)}`,
      type: "system",
      category: "follow",
      isRead: false,
    })
    .onConflictDoNothing()
    .returning({ id: notifications.id });
  if (!inserted) return;
  const result = await enqueueWebPushWithRecoveryWithin(tx, id, recipientId);
  if (result.reason === "saturated" || result.reason === "error")
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "user_follow",
        reason: result.reason,
      }),
    );
}
