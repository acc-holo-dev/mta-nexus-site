import { createHash } from "node:crypto";
import type { OrganizationAccessChange, OrganizationAccessNotificationData } from "@nexus/domain";
import {
  noticeStoredMessages,
  noticeStoredTitles,
  withBilingualParenthetical,
} from "@nexus/domain";
import type { db } from "../client";
import { notifications } from "../schema";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function accessMessage(change: OrganizationAccessChange, name: string) {
  const base = noticeStoredMessages.organizationAccess[change];
  const [en, ru] = base.split(" / ");
  return withBilingualParenthetical(en, ru, name);
}

/** Inbox is part of the authoritative write. Push degradation is isolated by a savepoint. */
export async function storeOrganizationAccessNotice(
  tx: Transaction,
  organization: { id: string; slug: string; name: string },
  recipientId: string,
  change: OrganizationAccessChange,
  auditId: string,
) {
  const id = `ntf_org_access_${createHash("sha256")
    .update(JSON.stringify([auditId, recipientId]))
    .digest("hex")}`;
  const data: OrganizationAccessNotificationData = {
    kind: "organization_access",
    event: change,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
  };
  await tx.insert(notifications).values({
    id,
    recipientId,
    title: noticeStoredTitles.organizationAccessChanged,
    message: accessMessage(change, organization.name),
    link:
      change === "removed" || change === "left"
        ? `/organizations/${encodeURIComponent(organization.slug)}`
        : `/workspace/organizations/${encodeURIComponent(organization.id)}`,
    type: "security",
    category: "security",
    isRead: false,
    data,
  });
  const result = await enqueueWebPushWithRecoveryWithin(tx, id, recipientId);
  if (result.reason === "saturated" || result.reason === "error")
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "organization_access",
        reason: result.reason,
      }),
    );
}
