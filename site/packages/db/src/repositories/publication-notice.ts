import { createHash } from "node:crypto";
import type {
  Content,
  PublicationActivityEvent,
  PublicationActivityNotificationData,
} from "@nexus/domain";
import { eq, inArray } from "drizzle-orm";
import type { db } from "../client";
import { notificationPreferences, notifications, organizations, servers } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ACTIVITY_MESSAGE_EN: Record<PublicationActivityEvent, string> = {
  created: "A publication was created in your context.",
  edited: "The publication changed. Editorial content returned to moderation.",
  published: "A moderator published the material.",
  archived: "The publication was archived.",
  restored: "The publication was restored to a draft and remains private.",
};

function withPublicationTitle(message: string, title: string) {
  const trimmed = title.trim().slice(0, 200);
  if (!trimmed) return message;
  return `${message} (${trimmed})`;
}

/** Author and actual context owners receive status-only notices. At most three recipients. */
export async function publicationNotice(
  tx: Transaction,
  item: Pick<Content, "id" | "title" | "slug" | "authorId" | "organizationId" | "serverId">,
  actorId: string | undefined,
  event: PublicationActivityEvent,
  auditId: string,
) {
  if (item.authorId === actorId && !item.organizationId && !item.serverId) return;
  const recipients = new Map<string, string>();
  recipients.set(item.authorId, `/workspace/content/${encodeURIComponent(item.id)}`);
  let organizationId = item.organizationId;
  if (item.serverId) {
    const [server] = await tx
      .select({ ownerId: servers.ownerId, organizationId: servers.organizationId })
      .from(servers)
      .where(eq(servers.id, item.serverId))
      .for("share")
      .limit(1);
    organizationId = server?.organizationId ?? undefined;
    if (server?.ownerId && !server.organizationId)
      recipients.set(
        server.ownerId,
        `/workspace/servers/${encodeURIComponent(item.serverId)}/content/${encodeURIComponent(item.id)}`,
      );
  }
  if (organizationId) {
    const [org] = await tx
      .select({ ownerId: organizations.ownerId })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .for("share")
      .limit(1);
    if (org)
      recipients.set(
        org.ownerId,
        item.serverId
          ? `/workspace/servers/${encodeURIComponent(item.serverId)}/content/${encodeURIComponent(item.id)}`
          : `/workspace/organizations/${encodeURIComponent(organizationId)}/content/${encodeURIComponent(item.id)}`,
      );
  }
  if (actorId) recipients.delete(actorId);
  const ids = [...recipients.keys()].sort();
  if (!ids.length) return;
  await lockNotificationPreferencesForUsers(tx, ids);
  const preferences = await tx
    .select({
      userId: notificationPreferences.userId,
      enabled: notificationPreferences.contentEnabled,
    })
    .from(notificationPreferences)
    .where(inArray(notificationPreferences.userId, ids))
    .limit(3);
  const disabled = new Set(preferences.filter((row) => !row.enabled).map((row) => row.userId));
  const data: PublicationActivityNotificationData = {
    kind: "publication_activity",
    event,
    contentId: item.id,
    contentTitle: item.title,
    contentSlug: item.slug,
  };
  const message = withPublicationTitle(ACTIVITY_MESSAGE_EN[event], item.title);
  for (const recipientId of ids) {
    if (disabled.has(recipientId)) continue;
    const id = `ntf_publication_${createHash("sha256")
      .update(JSON.stringify([auditId, recipientId]))
      .digest("hex")}`;
    await tx.insert(notifications).values({
      id,
      recipientId,
      title: "Publication activity",
      message,
      link: recipients.get(recipientId),
      type: "content",
      category: "content",
      isRead: false,
      data,
    });
    const result = await enqueueWebPushWithRecoveryWithin(tx, id, recipientId);
    if (result.reason === "saturated" || result.reason === "error")
      console.warn(
        JSON.stringify({
          event: "notification.push_outbox_degraded",
          producer: "publication",
          reason: result.reason,
        }),
      );
  }
}
