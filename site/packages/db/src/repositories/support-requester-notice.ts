import { createHash } from "node:crypto";
import type {
  SupportRequesterActivityEvent,
  SupportRequesterNotificationData,
} from "@nexus/domain";
import {
  noticeStoredMessages,
  noticeStoredTitles,
  withBilingualParenthetical,
} from "@nexus/domain";
import { eq } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function activityMessage(event: SupportRequesterActivityEvent, subject: string) {
  const base = noticeStoredMessages.supportActivity[event];
  const [en, ru] = base.split(" / ");
  return withBilingualParenthetical(en, ru, subject);
}

export async function supportRequesterNotice(
  tx: Transaction,
  supportCase: { id: string; requesterId: string; subject: string },
  event: SupportRequesterActivityEvent,
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
  const data: SupportRequesterNotificationData = {
    kind: "support_requester",
    event,
    caseId: supportCase.id,
    subject: supportCase.subject,
  };
  await tx.insert(notifications).values({
    id,
    recipientId: supportCase.requesterId,
    title: noticeStoredTitles.supportCaseActivity,
    message: activityMessage(event, supportCase.subject),
    link: `/support/${encodeURIComponent(supportCase.id)}`,
    type: "system",
    category: "system",
    isRead: false,
    data,
  });
  const result = await enqueueWebPushWithRecoveryWithin(tx, id, supportCase.requesterId);
  if (result.reason === "saturated" || result.reason === "error")
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "support_requester",
        reason: result.reason,
      }),
    );
}
