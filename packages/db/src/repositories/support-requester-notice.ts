import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushOutboxForNotification } from "./web-push-outbox";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function supportRequesterNotice(
  tx: Transaction,
  supportCase: { id: string; requesterId: string },
  event: "reply" | "open" | "resolved" | "closed",
  auditId: string,
) {
  await lockNotificationPreferencesForUsers(tx, [supportCase.requesterId]);
  const [preferences] = await tx
    .select({ enabled: notificationPreferences.systemEnabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, supportCase.requesterId))
    .limit(1);
  if (preferences?.enabled === false) return;
  const id = `ntf_support_${createHash("sha256")
    .update(JSON.stringify([auditId, supportCase.requesterId]))
    .digest("hex")}`;
  await tx.insert(notifications).values({
    id,
    recipientId: supportCase.requesterId,
    title: "Support case activity",
    message: `Support case ${supportCase.id}: ${event}.`,
    link: `/support/${encodeURIComponent(supportCase.id)}`,
    type: "system",
    category: "system",
    isRead: false,
  });
  try {
    const result = await tx.transaction((pushTx) =>
      enqueueWebPushOutboxForNotification(pushTx, id, supportCase.requesterId),
    );
    if (result.reason === "saturated")
      console.warn(
        JSON.stringify({
          event: "notification.push_outbox_degraded",
          producer: "support_requester",
          reason: "saturated",
        }),
      );
  } catch {
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "support_requester",
        reason: "error",
      }),
    );
  }
}
