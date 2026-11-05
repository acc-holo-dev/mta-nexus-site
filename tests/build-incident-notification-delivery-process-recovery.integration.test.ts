import { expect, it, vi } from "vitest";
import {
  actor,
  BuildIncidentNotificationDeliveryRepository,
  db,
  delivery,
  drain,
  failInsert,
  isolated,
  listExhaustedNotificationDeliveries,
  moderator,
  notices,
  publishedBuild,
  quarantine,
  ready,
  resetExhaustedNotificationDelivery,
  servedReceipt,
  setupBuildIncidentNotificationDelivery,
  source,
} from "./helpers/build-incident-notification-delivery-harness";

setupBuildIncidentNotificationDelivery();

it("pages recipients across concurrent workers without skipping the cursor", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const recipients = await Promise.all(Array.from({ length: 5 }, () => actor("user", "dl")));
  recipients.sort();
  const { productId, buildId } = await publishedBuild(authorId);
  for (const recipientId of recipients) {
    await servedReceipt(recipientId, productId, buildId);
  }
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  await Promise.all([
    delivery.processNext(2),
    new BuildIncidentNotificationDeliveryRepository().processNext(2),
  ]);
  const afterConcurrent = await source(buildId);
  expect([recipients[1], recipients[3]]).toContain(afterConcurrent.lastRecipientId);
  await drain(buildId, 2);
  expect((await notices(buildId, recipients)).map((row) => row.recipientId)).toEqual(recipients);
  expect((await source(buildId)).completedAt).not.toBeNull();
});

it("rolls back a failed page, exhausts attempts, then resumes after a single-id operator reset", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const first = await actor("user", "aaa");
  const second = await actor("user", "bbb");
  const { productId, buildId } = await publishedBuild(authorId);
  await servedReceipt(first, productId, buildId);
  await servedReceipt(second, productId, buildId);
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  const removeFailure = await failInsert("notifications", second);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ready(buildId);
    expect(await delivery.processNext(2)).toEqual({
      state: attempt === 5 ? "failed" : "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(buildId)).toMatchObject({
      attempts: attempt,
      lastRecipientId: null,
      completedAt: null,
    });
    expect((await source(buildId)).availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await notices(buildId, [first, second])).toEqual([]);
  }
  expect((await delivery.stats()).failed).toBeGreaterThanOrEqual(1);
  expect(await delivery.processNext(2)).toEqual({
    state: "idle",
    recipients: 0,
    stored: 0,
    pushDeferred: 0,
  });

  const listed = await listExhaustedNotificationDeliveries({
    channel: "build_incident",
    limit: 20,
  });
  expect(listed).toEqual([
    expect.objectContaining({
      channel: "build_incident",
      failed: expect.any(Number),
      items: expect.arrayContaining([
        expect.objectContaining({ channel: "build_incident", id: buildId, attempts: 5 }),
      ]),
    }),
  ]);

  await removeFailure();
  await ready(buildId);
  await delivery.processNext(2);
  expect(await notices(buildId, [first, second])).toEqual([]);

  expect(await resetExhaustedNotificationDelivery("build_incident", buildId)).toEqual({
    channel: "build_incident",
    id: buildId,
    reset: true,
  });
  expect(await resetExhaustedNotificationDelivery("build_incident", buildId)).toEqual({
    channel: "build_incident",
    id: buildId,
    reset: false,
  });
  await drain(buildId, 2);
  expect((await notices(buildId, [first, second])).map((row) => row.recipientId)).toEqual(
    [first, second].sort(),
  );
});

it("recovers a lost process before commit with no partial inbox or cursor", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const recipientId = await actor("user", "dl");
  const { productId, buildId } = await publishedBuild(authorId);
  await servedReceipt(recipientId, productId, buildId);
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  const original = db.transaction.bind(db);
  vi.spyOn(db, "transaction").mockImplementationOnce((run) =>
    original(async (tx) => {
      await run(tx);
      throw Error("SIMULATED_PROCESS_EXIT");
    }),
  );
  await expect(delivery.processNext()).rejects.toThrow("SIMULATED_PROCESS_EXIT");
  vi.restoreAllMocks();
  expect(await notices(buildId, [recipientId])).toEqual([]);
  expect(await source(buildId)).toMatchObject({
    attempts: 0,
    lastRecipientId: null,
    completedAt: null,
  });
  await drain(buildId);
  expect(await notices(buildId, [recipientId])).toHaveLength(1);
});

it("validates batch bounds and keeps the default page at twenty recipients", async () => {
  for (const limit of [0, -1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expect(delivery.processNext(limit)).rejects.toThrow(RangeError);
  }
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const recipients = await Promise.all(Array.from({ length: 21 }, () => actor("user", "dl")));
  const { productId, buildId } = await publishedBuild(authorId);
  for (const recipientId of recipients) {
    await servedReceipt(recipientId, productId, buildId);
  }
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);
  expect(await delivery.processNext()).toEqual({
    state: "progress",
    recipients: 20,
    stored: 20,
    pushDeferred: 0,
  });
  expect(await notices(buildId, recipients)).toHaveLength(20);
  await drain(buildId, 100);
  expect(await notices(buildId, recipients)).toHaveLength(21);
});
