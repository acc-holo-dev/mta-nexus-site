import { createHash } from "node:crypto";
import type { BuildLifecycleNotificationData } from "@nexus/domain";
import { sql } from "drizzle-orm";
import type { db } from "../client";
import { organizationMembers, organizations, users } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { notificationRepository } from "./notifications";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function safeId(value: string) {
  return Boolean(value) && value.length <= 128 && /^[A-Za-z0-9_-]+$/u.test(value);
}

/** Publisher workspace deep link for a concrete build. */
export function publisherBuildHref(productId: string, buildId: string) {
  if (!safeId(productId) || !safeId(buildId)) return "/workspace/resources";
  return `/workspace/resources/${encodeURIComponent(productId)}/builds/${encodeURIComponent(buildId)}`;
}

function buildLifecycleNoticeId(seed: string, recipientId: string) {
  return `ntf_build_lifecycle_${createHash("sha256")
    .update(JSON.stringify([seed, recipientId]))
    .digest("hex")
    .slice(0, 40)}`;
}

export function buildLifecycleNoticeSeed(event: string, buildId: string, auditId: string) {
  return createHash("sha256")
    .update(JSON.stringify(["build_lifecycle", event, buildId, auditId]))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Notify current product managers (author/org owner/admins/manage_products)
 * without inventing malware details or exposing former owners.
 */
export async function notifyProductManagersWithin(
  tx: Tx,
  input: {
    authorId: string;
    organizationId: string | null;
    title: string;
    message: string;
    link: string;
    data: BuildLifecycleNotificationData;
    noticeSeed: string;
    producer: string;
  },
) {
  const recipients = await tx.execute(sql`
    select ${users.id} as id
    from ${users}
    where (
      (${input.organizationId}::text is null and ${users.id} = ${input.authorId})
      or exists (select 1 from ${organizations}
        where ${organizations.id} = ${input.organizationId} and ${organizations.ownerId} = ${users.id})
      or exists (select 1 from ${organizationMembers}
        where ${organizationMembers.organizationId} = ${input.organizationId}
          and ${organizationMembers.userId} = ${users.id}
          and (${organizationMembers.role} = 'admin'
            or (${organizationMembers.role} in ('member', 'developer')
              and ${organizationMembers.permissions} @> '["manage_products"]'::jsonb)))
    )
    order by ${users.id}
  `);
  const recipientIds = recipients.map((row) => String(row.id));
  await lockNotificationPreferencesForUsers(tx, recipientIds);

  let stored = 0;
  let pushQueued = 0;
  let pushQueueDegraded = 0;
  for (const recipientId of recipientIds) {
    const result = await notificationRepository.createWithPushOutboxWithin(
      tx,
      {
        id: buildLifecycleNoticeId(input.noticeSeed, recipientId),
        recipientId,
        title: input.title,
        message: input.message,
        link: input.link,
        type: "system",
        category: "system",
        data: input.data,
      },
      true,
    );
    if (result.notification) {
      stored++;
      pushQueued += result.pushJobs;
      if (result.pushQueueState === "saturated" || result.pushQueueState === "error") {
        pushQueueDegraded++;
      }
    }
  }
  if (pushQueueDegraded > 0) {
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: input.producer,
        notifications: stored,
        pushQueued,
        pushQueueDegraded,
      }),
    );
  }
  return stored;
}
