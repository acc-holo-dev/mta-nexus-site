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

import { supportMessageDiscoveryRepository as discovery } from "../packages/db/src/repositories/support-message-discovery";
import {
  installSupportMessageDiscoveryQueryHooks,
  supportMessageDiscoveryQueryBase as base,
  supportMessageDiscoveryQueryId as id,
  supportMessageDiscoveryQueryMessageId as messageId,
  supportMessageDiscoveryQueryRow as row,
  supportMessageDiscoveryQueryStamp as stamp,
  supportMessageDiscoveryQueryState as state,
} from "./helpers/support-message-discovery-query-harness";

installSupportMessageDiscoveryQueryHooks();

it("checks live ownership before any message reads and uses one read-only snapshot", async () => {
  state.rows = [[["owner", "user"]], [row()], [[stamp]], []];
  expect(await discovery.page(id, "owner", base)).toMatchObject({
    supportCase: { id, subject: "Private case", status: "open" },
    items: [],
    until: stamp,
    olderCursor: null,
    newerCursor: null,
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(4);
  expect(state.queries[3].params).toEqual([id, stamp, 20]);
  expect(state.queries[3].sql).toContain("left(");
  expect(state.queries[3].sql).not.toMatch(/author_id|related_id|requester_id|offset|count\(/u);
});
it.each(["outsider", "revoked-staff"])("denies %s before reading messages", async (actor) => {
  state.rows = [[[actor, "user"]], [row()]];
  await expect(discovery.page(id, actor, base)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
});
it("denies a deleted session actor and restricts the staff surface even for an owner", async () => {
  state.rows = [[]];
  await expect(discovery.page(id, "deleted", base)).rejects.toMatchObject({ statusCode: 401 });
  state.rows = [[["owner", "user"]], [row()]];
  await expect(discovery.page(id, "owner", base, true)).rejects.toMatchObject({ statusCode: 403 });
});
it("allows current moderators without forwarding case relationships or staff identities", async () => {
  state.rows = [
    [["moderator", "moderator"]],
    [row()],
    [[stamp]],
    [[messageId, "staff", "Private reply", false, stamp]],
    [[false, false]],
  ];
  const result = await discovery.page(id, "moderator", base, true);
  expect(result.items).toHaveLength(1);
  expect(JSON.stringify(result)).not.toMatch(
    /moderator|private-order|requesterId|authorId|related/u,
  );
});
it("escapes SQL wildcards literally and combines role/text filters with the case cutoff", async () => {
  state.rows = [[["owner", "user"]], [row()], [[stamp]], []];
  await discovery.page(id, "owner", { group: "staff", query: "100%_\\" });
  expect(state.queries[3].params).toEqual([id, stamp, "staff", "%100\\%\\_\\\\%", 20]);
  expect(state.queries[3].sql).toContain("ilike");
});
it("caps legacy Unicode text without splitting surrogate pairs", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    [[stamp]],
    [[messageId, "requester", `${"x".repeat(3999)}😀suffix`, false, stamp]],
    [[false, false]],
  ];
  const result = await discovery.page(id, "owner", base);
  expect(result.items[0]).toMatchObject({ body: "x".repeat(3999), truncated: true });
});
