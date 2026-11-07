import { createHash } from "node:crypto";
import type { OrganizationAccessChange, OrganizationAccessNotificationData } from "@nexus/domain";
import type { db } from "../client";
import { notifications } from "../schema";
import { enqueueWebPushWithRecoveryWithin } from "./web-push-admission-recovery";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ACCESS_MESSAGE_EN: Record<OrganizationAccessChange, string> = {
  added: "You were added to the team.",
  updated: "Your role or delegated access changed.",
  removed: "Your team access was revoked.",
  left: "You left the team.",
  ownership_gained: "Organization ownership was transferred to you.",
  ownership_transferred: "You transferred organization ownership.",
};

function withOrganizationName(message: string, name: string) {
  const trimmed = name.trim().slice(0, 200);
  if (!trimmed) return message;
  return `${message} (${trimmed})`;
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
    title: "Organization access changed",
    message: withOrganizationName(ACCESS_MESSAGE_EN[change], organization.name),
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
