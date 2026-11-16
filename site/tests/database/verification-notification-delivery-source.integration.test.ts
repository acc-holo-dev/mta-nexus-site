import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import {
  actor,
  apply,
  auditEvents,
  db,
  delivery,
  drain,
  eq,
  isolated,
  jobs,
  ne,
  noticeId,
  notices,
  notifications,
  pendingLink,
  setupVerificationNotificationDelivery,
  source,
  sql,
  trackTrigger,
  untrackTrigger,
  users,
  verificationRequests,
} from "../helpers/verification-notification-delivery-harness";

setupVerificationNotificationDelivery();

it("delivers verification inbox through the shared worker repository without leaking private fields", async () => {
  const requesterId = await actor();
  const moderator = await actor("moderator");
  const request = await apply(requesterId);
  await isolated(request.id);
  expect(await delivery.processNext()).toEqual({
    state: "completed",
    recipients: 1,
    stored: 1,
    pushDeferred: 0,
  });
  expect((await source(request.id)).completedAt).toBeInstanceOf(Date);
  const stored = await notices(request.id);
  expect(stored).toEqual([
    expect.objectContaining({
      recipientId: moderator,
      title: "New verification request",
      message: "A verification request is awaiting review.",
      link: pendingLink(request.id),
      type: "security",
      category: "security",
    }),
  ]);
  expect(JSON.stringify(stored)).not.toContain("PRIVATE_");
  expect(JSON.stringify(stored)).not.toContain(requesterId);
  const dispatcher = await readFile(
    path.resolve(import.meta.dirname, "../../packages/db/scripts/run-web-push-dispatcher.ts"),
    "utf8",
  );
  expect(dispatcher).toContain("verificationNotificationDeliveryRepository");
  expect(dispatcher).toContain("verification-delivery");
});

it("atomically creates the request with its delivery source", async () => {
  const requesterId = await actor();
  const name = `verification_delivery_block_${randomUUID().replaceAll("-", "")}`;
  await db.execute(
    sql.raw(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'PRIVATE_INSERT_FAILURE'; end $$`,
    ),
  );
  trackTrigger("verification_notification_deliveries", name);
  await db.execute(
    sql.raw(
      `create trigger ${name} before insert on verification_notification_deliveries for each row execute function ${name}()`,
    ),
  );
  await expect(apply(requesterId)).rejects.toThrow();
  expect(
    await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.requesterId, requesterId)),
  ).toEqual([]);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.actorId, requesterId))).toEqual(
    [],
  );
  // Scope to this requester: the shared disposable DB may hold unrelated delivery rows.
  expect(
    await db
      .select({ id: jobs.verificationRequestId })
      .from(jobs)
      .innerJoin(verificationRequests, eq(jobs.verificationRequestId, verificationRequests.id))
      .where(eq(verificationRequests.requesterId, requesterId)),
  ).toEqual([]);
  await db.execute(sql.raw(`drop trigger ${name} on verification_notification_deliveries`));
  await db.execute(sql.raw(`drop function ${name}()`));
  untrackTrigger(name);
  const request = await apply(requesterId);
  expect(await source(request.id)).toMatchObject({
    event: "application",
    lastRecipientId: null,
    completedAt: null,
  });
});

it("uses current roles and the fixed account horizon", async () => {
  const demoted = await actor("moderator");
  const promoted = await actor();
  const late = await actor("admin");
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  await db.update(users).set({ role: "user" }).where(eq(users.id, demoted));
  await db.update(users).set({ role: "admin" }).where(eq(users.id, promoted));
  await db
    .update(users)
    .set({ createdAt: new Date("2002-01-01T00:00:00Z") })
    .where(eq(users.id, late));
  await drain(request.id);
  expect(await notices(request.id)).toMatchObject([
    {
      recipientId: promoted,
      title: "New verification request",
      message: "A verification request is awaiting review.",
      link: pendingLink(request.id),
    },
  ]);
  expect(await notices(request.id)).toHaveLength(1);
  expect(JSON.stringify(await notices(request.id))).not.toContain("PRIVATE_");
  expect(JSON.stringify(await notices(request.id))).not.toContain(requesterId);
});

it("keeps stable notice IDs across restart so completed delivery is idempotent", async () => {
  const moderator = await actor("moderator");
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  await drain(request.id);
  const first = await notices(request.id);
  expect(first).toEqual([
    expect.objectContaining({
      id: noticeId(request.id, moderator),
      recipientId: moderator,
      isRead: false,
    }),
  ]);
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, noticeId(request.id, moderator)));
  await db
    .update(jobs)
    .set({ availableAt: new Date("2099-01-01T00:00:00.000Z") })
    .where(ne(jobs.verificationRequestId, request.id));
  expect(await delivery.processNext()).toEqual({
    state: "idle",
    recipients: 0,
    stored: 0,
    pushDeferred: 0,
  });
  expect(await notices(request.id)).toEqual([
    expect.objectContaining({
      id: noticeId(request.id, moderator),
      isRead: true,
    }),
  ]);
});
