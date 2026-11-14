import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import {
  actor,
  builds,
  db,
  delivery,
  eq,
  isolated,
  jobs,
  moderator,
  noticeId,
  notices,
  notifications,
  products,
  publishedBuild,
  quarantine,
  servedReceipt,
  setupBuildIncidentNotificationDelivery,
  source,
  startedReceipt,
} from "../helpers/build-incident-notification-delivery-harness";

setupBuildIncidentNotificationDelivery();

it("enqueues SEC-002 fanout only when quarantine explicitly requests downloader notice", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const downloaderId = await actor("user", "dl");
  const { productId, buildId, version } = await publishedBuild(authorId);
  await servedReceipt(downloaderId, productId, buildId);

  await quarantine(buildId, moderatorId, false);
  expect(await db.select().from(jobs).where(eq(jobs.buildId, buildId))).toEqual([]);

  // Restore publish path for a second quarantine with notify.
  await db
    .update(builds)
    .set({
      status: "published",
      quarantinePreviousStatus: null,
      quarantineReason: null,
      quarantinedAt: null,
      quarantinedBy: null,
    })
    .where(eq(builds.id, buildId));
  await db
    .update(products)
    .set({ status: "published", currentVersion: version })
    .where(eq(products.id, productId));
  await quarantine(buildId, moderatorId, true);
  expect(await source(buildId)).toMatchObject({
    productId,
    version,
    attempts: 0,
    lastRecipientId: null,
    completedAt: null,
  });
});

it("delivers served-receipt recipients idempotently with generic security copy", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const first = await actor("user", "aaa");
  const second = await actor("user", "bbb");
  const skipped = await actor("user", "ccc");
  const { productId, buildId } = await publishedBuild(authorId);
  await servedReceipt(first, productId, buildId);
  await servedReceipt(second, productId, buildId);
  await startedReceipt(skipped, productId, buildId);
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  const existingId = noticeId(buildId, first);
  const originalTime = new Date("2000-06-01T00:00:00Z");
  await db.insert(notifications).values({
    id: existingId,
    recipientId: first,
    type: "security",
    category: "security",
    title: "Security notice for a downloaded build",
    message:
      "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library.",
    link: `/workspace/library/${encodeURIComponent(productId)}/versions`,
    isRead: true,
    createdAt: originalTime,
  });

  expect(await delivery.processNext()).toEqual({
    state: "completed",
    recipients: 2,
    stored: 1,
    pushDeferred: 0,
  });
  const stored = await notices(buildId, [first, second, skipped]);
  expect(stored.map((row) => row.recipientId)).toEqual([first, second].sort());
  expect(stored.find((row) => row.id === existingId)).toMatchObject({
    isRead: true,
    createdAt: originalTime,
  });
  for (const row of stored) {
    expect(row).toMatchObject({
      title: "Security notice for a downloaded build",
      link: `/workspace/library/${encodeURIComponent(productId)}/versions`,
      type: "security",
      category: "security",
    });
    expect(row.message).toContain("quarantined after a security review");
    expect(JSON.stringify(row)).not.toContain("PRIVATE_");
  }
  expect((await source(buildId)).completedAt).toBeInstanceOf(Date);

  const dispatcher = await readFile(
    path.resolve(import.meta.dirname, "../../packages/db/scripts/run-web-push-dispatcher.ts"),
    "utf8",
  );
  expect(dispatcher).toContain("buildIncidentNotificationDeliveryRepository");
});
