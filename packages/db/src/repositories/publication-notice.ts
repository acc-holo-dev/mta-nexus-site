import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { Content } from "@nexus/domain";
import type { db } from "../client";
import { notificationPreferences, notifications, organizations, servers } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushOutboxForNotification } from "./web-push-outbox";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Author and actual context owners receive status-only notices. At most three recipients. */
export async function publicationNotice(
  tx: Transaction,
  item: Pick<Content, "id" | "authorId" | "organizationId" | "serverId">,
  actorId: string | undefined,
  event: "created" | "edited" | "published" | "archived",
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
    if (server?.organizationId) organizationId = server.organizationId;
    else if (server?.ownerId)
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
  for (const recipientId of ids) {
    if (disabled.has(recipientId)) continue;
    const id = `ntf_publication_${createHash("sha256")
      .update(JSON.stringify([auditId, recipientId]))
      .digest("hex")}`;
    await tx.insert(notifications).values({
      id,
      recipientId,
      title: "Publication activity",
      message: `Publication ${item.id}: ${event}.`,
      link: recipients.get(recipientId),
      type: "content",
      category: "content",
      isRead: false,
    });
    try {
      const result = await tx.transaction((pushTx) =>
        enqueueWebPushOutboxForNotification(pushTx, id, recipientId),
      );
      if (result.reason === "saturated")
        console.warn(
          JSON.stringify({
            event: "notification.push_outbox_degraded",
            producer: "publication",
            reason: "saturated",
          }),
        );
    } catch {
      console.warn(
        JSON.stringify({
          event: "notification.push_outbox_degraded",
          producer: "publication",
          reason: "error",
        }),
      );
    }
  }
}
