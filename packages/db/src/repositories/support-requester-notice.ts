import { createHash } from "node:crypto";
import type {
  SupportRequesterActivityEvent,
  SupportRequesterNotificationData,
} from "@nexus/domain";
import { eq } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ACTIVITY_MESSAGE_EN: Record<SupportRequesterActivityEvent, string> = {
  reply: "Support replied to your case.",
  open: "Your case was reopened.",
  resolved: "Your case was marked as resolved.",
  closed: "Support closed your case.",
};

function withSubject(message: string, subject: string) {
  const trimmed = subject.trim().slice(0, 200);
  if (!trimmed) return message;
  return `${message} (${trimmed})`;
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
    title: "Support case activity",
    message: withSubject(ACTIVITY_MESSAGE_EN[event], supportCase.subject),
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
