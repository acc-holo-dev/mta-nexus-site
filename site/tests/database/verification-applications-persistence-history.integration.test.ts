import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  db,
  eq,
  repo,
  sql,
  user,
  verificationRequests,
} from "../helpers/verification-applications-persistence-harness";

describe("verification applications persistence: equal-microsecond own history", () => {
  it("traverses equal-microsecond own history in both directions without a removed-anchor lookup or account/filter reuse", async () => {
    const actorId = await user(),
      foreign = await user(),
      prefix = `history_${randomUUID().replaceAll("-", "")}`,
      createdAt = sql`'2026-10-11T00:00:00.123456Z'::timestamptz`;
    await db.insert(verificationRequests).values(
      Array.from({ length: 45 }, (_, n) => ({
        id: `${prefix}_${String(n).padStart(3, "0")}`,
        requesterId: actorId,
        targetType: "user",
        targetId: actorId,
        status: "rejected",
        notes: prefix,
        createdAt,
      })),
    );
    const filters = { query: prefix, status: "rejected", type: "user" },
      first = await repo.applications(actorId, filters),
      second = await repo.applications(actorId, {
        ...filters,
        cursor: JSON.parse(first.olderCursor ?? ""),
      }),
      third = await repo.applications(actorId, {
        ...filters,
        cursor: JSON.parse(second.olderCursor ?? ""),
      });
    expect([first.items.length, second.items.length, third.items.length]).toEqual([20, 20, 5]);
    expect(
      new Set([...first.items, ...second.items, ...third.items].map((item) => item.id)).size,
    ).toBe(45);
    expect(first.items[0].createdAt).toBe("2026-10-11T00:00:00.123456Z");
    const back = await repo.applications(actorId, {
      ...filters,
      cursor: JSON.parse(third.newerCursor ?? ""),
    });
    expect(back.items.map((item) => item.id)).toEqual(second.items.map((item) => item.id));
    const anchor = JSON.parse(first.olderCursor ?? "");
    await db.delete(verificationRequests).where(eq(verificationRequests.id, anchor.id));
    expect(
      (await repo.applications(actorId, { ...filters, cursor: anchor })).items.map(
        (item) => item.id,
      ),
    ).toEqual(second.items.map((item) => item.id));
    await expect(repo.applications(foreign, { ...filters, cursor: anchor })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    await expect(
      repo.applications(actorId, { ...filters, status: "all", cursor: anchor }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });
});
