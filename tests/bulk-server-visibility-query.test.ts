import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createBulkServerVisibilityQueryDbMock } = await import(
    "./helpers/bulk-server-visibility-query-harness"
  );
  return createBulkServerVisibilityQueryDbMock();
});

import { ServerRepository } from "../packages/db/src/repositories/servers";
import {
  bulkServerVisibilityQueryInput as input,
  bulkServerVisibilityQueryRecords as records,
  bulkServerVisibilityQueryState as state,
  bulkServerVisibilityQueryTime as time,
  bulkServerVisibilityQueryWrites as writes,
  installBulkServerVisibilityQueryHooks,
  prepareBulkServerVisibilityQuery as prepare,
} from "./helpers/bulk-server-visibility-query-harness";

installBulkServerVisibilityQueryHooks();

const repo = new ServerRepository();

it("previews only current scoped listings and reads each live authority table once under ordered locks", async () => {
  const preview = await repo.previewVisibilityBatch("actor", input);
  expect(preview.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
  expect(preview.items[2]).toMatchObject({
    status: "suspended",
    organization: true,
    before: "unlisted",
    after: "private",
    changed: true,
    revision: time,
  });
  expect(preview).not.toHaveProperty("grants");
  expect(preview.items[0]).not.toHaveProperty("ownerId");
  expect(state.queries).toHaveLength(4);
  const listings = state.queries[0];
  expect(listings.sql).toContain('order by "servers"."id" asc for share');
  expect(listings.sql).toContain('"servers"."organization_id" is null');
  expect(listings.sql).toContain('"users"."role" =');
  expect(listings.params).toContain('["manage_servers"]');
  expect(state.queries[1].sql).toContain('from "users"');
  expect(state.queries[2].params).toEqual(["org"]);
  expect(state.queries[3].params).toEqual(["org", "actor"]);
  expect(writes()).toHaveLength(0);
});
it.each(["missing", "revoked", "orphan", "account"])(
  "refuses incomplete live authority (%s) without changing any listing",
  async (kind) => {
    prepare();
    if (kind === "missing") state.rows[0] = [];
    if (kind === "revoked") state.rows[3] = [["org", "developer", []]];
    if (kind === "orphan") state.rows[2] = [];
    if (kind === "account") state.rows[1] = [];
    await expect(repo.previewVisibilityBatch("actor", input)).rejects.toMatchObject({
      code: kind === "missing" ? "NOT_FOUND" : "FORBIDDEN",
    });
    expect(writes()).toHaveLength(0);
  },
);
it("honors only the currently locked platform administrator and does not reread delegated grants", async () => {
  state.rows = [records(), [["admin"]]];
  await repo.previewVisibilityBatch("platform-admin", input);
  expect(state.queries).toHaveLength(2);
  expect(state.queries[1].sql).toContain("for share");
});
it.each([
  { serverIds: [] },
  { serverIds: ["a", "a"] },
  { serverIds: ["../foreign"] },
  { serverIds: Array.from({ length: 21 }, (_, i) => `s${i}`) },
])("bounds selection before acquiring locks (%j)", async (selection) => {
  await expect(
    repo.previewVisibilityBatch("actor", { ...input, ...selection }),
  ).rejects.toMatchObject({ code: "SERVER_BATCH_INVALID" });
  expect(state.queries).toHaveLength(0);
});
