import { createHash } from "node:crypto";
import type { db } from "../client";
import { notifications } from "../schema";
import { enqueueWebPushOutboxForNotification } from "./web-push-outbox";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OrganizationAccessChange =
  | "added"
  | "updated"
  | "removed"
  | "left"
  | "ownership_gained"
  | "ownership_transferred";
/** Inbox is part of the authoritative write. Push degradation is isolated by a savepoint. */
export async function storeOrganizationAccessNotice(
  tx: Transaction,
  organization: { id: string; slug: string },
  recipientId: string,
  change: OrganizationAccessChange,
  auditId: string,
) {
  const id = `ntf_org_access_${createHash("sha256")
    .update(JSON.stringify([auditId, recipientId]))
    .digest("hex")}`;
  await tx.insert(notifications).values({
    id,
    recipientId,
    title: "Organization access changed",
    message: `Organization ${organization.id}: ${change}.`,
    link:
      change === "removed" || change === "left"
        ? `/organizations/${encodeURIComponent(organization.slug)}`
        : `/workspace/organizations/${encodeURIComponent(organization.id)}`,
    type: "security",
    category: "security",
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
          producer: "organization_access",
          reason: "saturated",
        }),
      );
  } catch {
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "organization_access",
        reason: "error",
      }),
    );
  }
}
