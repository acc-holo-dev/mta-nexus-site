import { db, notifications, supportActivityRepository, users } from "@nexus/db";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  audit,
  cases,
  fixture,
  initiatingToken,
  required,
} from "./helpers/support-workspace-persistence-harness";

it("persists requester resolution/reopening, private status history and generic receipts", async () => {
  const f = await fixture();
  const resolved = await cases.updateStatus(
    f.supportCase.id,
    "resolved",
    audit(f.supportCase.id, f.owner.id),
    "open",
    await initiatingToken(f.owner.id),
    f.supportCase.updatedAt,
  );
  const opened = await cases.updateStatus(
    f.supportCase.id,
    "open",
    audit(f.supportCase.id, f.owner.id),
    "resolved",
    await initiatingToken(f.owner.id),
    required(resolved).updatedAt,
  );
  expect(required(opened).updatedAt.getTime()).toBeGreaterThan(
    required(resolved).updatedAt.getTime(),
  );
  expect(
    (await supportActivityRepository.history(f.supportCase.id, f.owner.id)).items.map(
      (item) => item.to,
    ),
  ).toEqual(["open", "resolved"]);
  await expect(
    supportActivityRepository.history(f.supportCase.id, f.other.id),
  ).rejects.toMatchObject({ statusCode: 404 });
  const inbox = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, f.owner.id));
  expect(inbox).toHaveLength(2);
  expect(inbox.every((item) => !item.message.includes("Private support"))).toBe(true);
});

it("respects staff closure and live role revocation for status, history and replies", async () => {
  const f = await fixture();
  const closed = await cases.updateStatus(
    f.supportCase.id,
    "closed",
    audit(f.supportCase.id, f.staff.id),
    "open",
    await initiatingToken(f.staff.id),
    f.supportCase.updatedAt,
  );
  await expect(
    cases.updateStatus(
      f.supportCase.id,
      "open",
      audit(f.supportCase.id, f.owner.id),
      "closed",
      await initiatingToken(f.owner.id),
      required(closed).updatedAt,
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.staff.id));
  await expect(
    cases.updateStatus(
      f.supportCase.id,
      "open",
      audit(f.supportCase.id, f.staff.id),
      "closed",
      await initiatingToken(f.staff.id),
      required(closed).updatedAt,
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    supportActivityRepository.history(f.supportCase.id, f.staff.id),
  ).rejects.toMatchObject({ statusCode: 404 });
});

it("serializes competing requester transitions and refuses same-status revision reuse after an ABA change", async () => {
  const f = await fixture();
  const results = await Promise.all([
    cases.updateStatus(
      f.supportCase.id,
      "resolved",
      audit(f.supportCase.id, f.owner.id),
      "open",
      await initiatingToken(f.owner.id),
      f.supportCase.updatedAt,
    ),
    cases.updateStatus(
      f.supportCase.id,
      "resolved",
      audit(f.supportCase.id, f.owner.id),
      "open",
      await initiatingToken(f.owner.id),
      f.supportCase.updatedAt,
    ),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const current = required(results.find(Boolean));
  await cases.updateStatus(
    f.supportCase.id,
    "open",
    audit(f.supportCase.id, f.staff.id),
    "resolved",
    await initiatingToken(f.staff.id),
    current.updatedAt,
  );
  expect(
    await cases.updateStatus(
      f.supportCase.id,
      "closed",
      audit(f.supportCase.id, f.staff.id),
      "open",
      await initiatingToken(f.staff.id),
      f.supportCase.updatedAt,
    ),
  ).toBeNull();
});
