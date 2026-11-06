import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createSupportMessageDiscoveryQueryDbMock } = await import(
    "./helpers/support-message-discovery-query-harness"
  );
  return createSupportMessageDiscoveryQueryDbMock();
});
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", () => ({
  enqueueWebPushWithRecoveryWithin: vi
    .fn()
    .mockResolvedValue({ queued: 0, reason: "no_subscriptions" }),
}));

import { supportCaseRepository as cases } from "../packages/db/src/repositories/support";
import { supportMessageDiscoveryRepository as discovery } from "../packages/db/src/repositories/support-message-discovery";
import {
  installSupportMessageDiscoveryQueryHooks,
  supportMessageDiscoveryQueryBase as base,
  supportMessageDiscoveryQueryCursor as cursor,
  supportMessageDiscoveryQueryFingerprint as fingerprint,
  supportMessageDiscoveryQueryId as id,
  supportMessageDiscoveryQueryMessageId as messageId,
  supportMessageDiscoveryQueryRow as row,
  supportMessageDiscoveryQueryStamp as stamp,
  supportMessageDiscoveryQueryState as state,
} from "./helpers/support-message-discovery-query-harness";

installSupportMessageDiscoveryQueryHooks();

it.each(["older", "newer"] as const)(
  "resolves %s cursors inside the retained case/filter window",
  async (direction) => {
    const later = "2026-10-12T00:01:00.000000Z";
    state.rows = [[["owner", "user"]], [row()], [[later]], [[messageId, stamp]], []];
    expect(
      (await discovery.page(id, "owner", { ...base, cursor: { ...cursor, direction } })).until,
    ).toBe(stamp);
    expect(state.queries[3].params).toEqual([id, stamp, messageId, 1]);
    expect(state.queries[4].params).toEqual([id, stamp, stamp, messageId, 20]);
    expect(state.queries[4].sql).toContain(direction === "older" ? ") < (" : ") > (");
    expect(state.queries[4].sql).toContain(
      direction === "older" ? '"created_at" desc' : '"created_at" asc',
    );
  },
);
it("includes the focused old message and offers both navigation directions with exact times", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    [[stamp]],
    [[messageId, stamp]],
    [[messageId, "requester", "Focused", false, stamp]],
    [[true, true]],
  ];
  const result = await discovery.page(id, "owner", { ...base, focus: messageId });
  expect(result.focus).toBe(messageId);
  expect(result.items[0].createdAt).toBe(stamp);
  expect(result.olderCursor).toEqual(cursor);
  expect(result.newerCursor).toEqual({ ...cursor, direction: "newer" });
  expect(state.queries[4].sql).toContain(") <= (");
  expect(state.queries[5].sql.match(/exists\(/gu)).toHaveLength(2);
});
it.each([
  { cursor: { ...cursor, context: fingerprint("another") } },
  { cursor, query: "changed" },
  { cursor, group: "staff" as const },
  { cursor: { ...cursor, id: "../secret" } },
  { focus: messageId, query: "incompatible" },
])("rejects a reused or malformed context before storage: %j", async (extra) => {
  await expect(discovery.page(id, "owner", { ...base, ...extra })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
});
it.each([false, true])(
  "rejects missing scoped anchors without exposing another case (focus %s)",
  async (focus) => {
    state.rows = [[["owner", "user"]], [row()], [[stamp]], []];
    await expect(
      discovery.page(id, "owner", { ...base, ...(focus ? { focus: messageId } : { cursor }) }),
    ).rejects.toMatchObject({ statusCode: focus ? 404 : 410 });
    expect(state.queries).toHaveLength(4);
  },
);
it("rejects a future snapshot before reading messages", async () => {
  state.rows = [[["owner", "user"]], [row()], [[stamp]]];
  await expect(
    discovery.page(id, "owner", { ...base, until: "9999-01-01T00:00:00.000000Z" }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(3);
});
it("authorizes the existing reply thread from live data and keeps count/page in the same snapshot", async () => {
  state.rows = [[["owner", "user"]], [row()], [[601]], []];
  const result = await cases.authorizedThread(id, "owner", 7);
  expect(result).toMatchObject({
    requester: true,
    staff: false,
    messages: { page: 7, pageSize: 100, total: 601, totalPages: 7 },
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries[3].params).toEqual([id, 100, 600]);
});
