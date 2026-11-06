import { createHash } from "node:crypto";
import { auditEvents, db, notifications, supportCaseMessages, users } from "@nexus/db";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  audit,
  cases,
  fixture,
  id,
  initiatingToken,
  randomUUID,
  required,
} from "./helpers/support-workspace-persistence-harness";

it("replays an authorized committed reply after closure without duplicating messages or receipts", async () => {
  const f = await fixture(),
    messageId = id("spm"),
    requestKey = randomUUID();
  const input = {
    id: messageId,
    caseId: f.supportCase.id,
    authorId: f.staff.id,
    authorRole: "staff" as const,
    body: "Sensitive staff answer",
    expectedStatus: "open" as const,
    expectedUpdatedAt: f.supportCase.updatedAt,
  };
  const request = {
    actorId: f.staff.id,
    requestKey,
    operation: "reply" as const,
    fingerprint: "a".repeat(64),
    caseId: f.supportCase.id,
    messageId,
  };
  const first = await cases.addIdempotentMessage(
    input,
    audit(f.supportCase.id, f.staff.id, "support.message.created"),
    request,
    await initiatingToken(f.staff.id),
  );
  expect(first.kind).toBe("created");
  if (first.kind !== "created") throw new Error("Reply did not persist");
  await cases.updateStatus(
    f.supportCase.id,
    "closed",
    audit(f.supportCase.id, f.staff.id),
    "open",
    await initiatingToken(f.staff.id),
    first.supportCase.updatedAt,
  );
  const replay = await cases.addIdempotentMessage(
    input,
    audit(f.supportCase.id, f.staff.id, "support.message.created"),
    request,
    await initiatingToken(f.staff.id),
  );
  expect(replay.kind).toBe("replayed");
  expect(
    await db.select().from(supportCaseMessages).where(eq(supportCaseMessages.id, messageId)),
  ).toHaveLength(1);
  const notices = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, f.owner.id),
        eq(notifications.message, `Support case ${f.supportCase.id}: reply.`),
      ),
    );
  expect(notices).toHaveLength(1);
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.staff.id));
  await expect(
    cases.findMutationReplay(request, await initiatingToken(request.actorId)),
  ).rejects.toMatchObject({ statusCode: 404 });
});

it("rolls back the case and audit when authoritative inbox storage fails", async () => {
  const f = await fixture(),
    auditId = id("aud"),
    noticeId = `ntf_support_${createHash("sha256")
      .update(JSON.stringify([auditId, f.owner.id]))
      .digest("hex")}`;
  await db.insert(notifications).values({
    id: noticeId,
    recipientId: f.owner.id,
    title: "Fixture collision",
    message: "Fixture",
    type: "system",
    category: "system",
    isRead: false,
  });
  await expect(
    cases.updateStatus(
      f.supportCase.id,
      "resolved",
      audit(f.supportCase.id, f.owner.id, "support.case.status_changed", auditId),
      "open",
      await initiatingToken(f.owner.id),
      f.supportCase.updatedAt,
    ),
  ).rejects.toThrow();
  expect(required(await cases.findById(f.supportCase.id)).status).toBe("open");
  expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toEqual([]);
});
