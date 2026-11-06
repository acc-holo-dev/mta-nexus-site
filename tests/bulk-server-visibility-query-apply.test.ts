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
  bulkServerVisibilityQueryNext as next,
  bulkServerVisibilityQueryRecords as records,
  bulkServerVisibilityQueryState as state,
  bulkServerVisibilityQueryTime as time,
  bulkServerVisibilityQueryWrites as writes,
  installBulkServerVisibilityQueryHooks,
  prepareBulkServerVisibilityQuery as prepare,
} from "./helpers/bulk-server-visibility-query-harness";

installBulkServerVisibilityQueryHooks();

const repo = new ServerRepository();

it("applies one bounded update and one mandatory audit insert, without changing endpoints, status or telemetry", async () => {
  const preview = await repo.previewVisibilityBatch("actor", input);
  state.queries = [];
  prepare();
  state.rows.push([
    ["a", "private", next],
    ["b", "private", next],
    ["c", "private", next],
  ]);
  const saved = await repo.applyVisibilityBatch(
    "actor",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b", "audit-c"],
  );
  expect(saved.items.every((row) => row.visibility === "private" && row.revision === next)).toBe(
    true,
  );
  expect(writes()).toHaveLength(2);
  expect(state.queries[0].sql).toContain('order by "servers"."id" asc for update');
  const update = writes()[0];
  expect(update.sql).toContain("greatest(clock_timestamp()");
  expect(update.params).toEqual(["private", "a", "b", "c"]);
  const set = update.sql.split(" set ")[1].split(" where ")[0];
  for (const field of [
    "owner_id",
    "organization_id",
    "ip_address",
    "port",
    "is_verified",
    "endpoint_revision",
    "current_players",
    "last_observed_at",
    "status",
  ])
    expect(set).not.toContain(`"${field}"`);
  const audits = writes()[1];
  expect(audits.params).toContain("server.updated");
  expect(audits.params).toContain(
    JSON.stringify({
      fields: ["visibility"],
      previousVisibility: "public",
      visibility: "private",
      previewRevision: preview.previewRevision,
      batchSize: 3,
    }),
  );
});
it("keeps already-matching rows and their revisions intact and records only actual changes", async () => {
  const rows = records().map((row) => [...row]);
  rows[0][5] = "private";
  rows[2][5] = "private";
  prepare(rows);
  const preview = await repo.previewVisibilityBatch("actor", input);
  expect(preview.items.map((row) => row.changed)).toEqual([false, true, false]);
  state.queries = [];
  prepare(rows);
  state.rows.push([["b", "private", next]]);
  const saved = await repo.applyVisibilityBatch(
    "actor",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b", "audit-c"],
  );
  expect(saved.items).toEqual([
    { id: "a", visibility: "private", changed: false, revision: time },
    { id: "b", visibility: "private", changed: true, revision: next },
    { id: "c", visibility: "private", changed: false, revision: time },
  ]);
  expect(writes()[0].params).toEqual(["private", "b"]);
  expect(writes()[1].params).toContain("audit-b");
  expect(writes()[1].params).not.toContain("audit-a");
});
it("handles an all-matching review without a timestamp or audit write", async () => {
  const rows = records().map((row) => {
    const copy = [...row];
    copy[5] = "private";
    return copy;
  });
  prepare(rows);
  const preview = await repo.previewVisibilityBatch("actor", input);
  state.queries = [];
  prepare(rows);
  expect(
    (
      await repo.applyVisibilityBatch(
        "actor",
        { ...input, previewRevision: preview.previewRevision },
        ["a1", "a2", "a3"],
      )
    ).items.every((row) => !row.changed && row.revision === time),
  ).toBe(true);
  expect(writes()).toHaveLength(0);
});
it.each(["name", "revision", "visibility", "ownership", "grant", "actor", "target"])(
  "refuses an outdated or retargeted review (%s) before any write",
  async (kind) => {
    const preview = await repo.previewVisibilityBatch("actor", input);
    state.queries = [];
    const rows = records();
    if (kind === "name") rows[1][1] = "Changed";
    if (kind === "revision") rows[1][6] = next;
    if (kind === "visibility") rows[1][5] = "unlisted";
    if (kind === "ownership") rows[0][2] = "new-owner";
    prepare(rows);
    if (kind === "grant") state.rows[3] = [["org", "admin", []]];
    await expect(
      repo.applyVisibilityBatch(
        kind === "actor" ? "other" : "actor",
        {
          ...input,
          visibility: kind === "target" ? "public" : "private",
          previewRevision: preview.previewRevision,
        },
        ["a1", "a2", "a3"],
      ),
    ).rejects.toMatchObject({
      code: ["ownership", "actor"].includes(kind) ? "FORBIDDEN" : "SERVER_BATCH_CHANGED",
    });
    expect(writes()).toHaveLength(0);
  },
);
it("fails if the complete audit cannot be recorded or acknowledgements do not match stored rows", async () => {
  const preview = await repo.previewVisibilityBatch("actor", input);
  prepare();
  state.rows.push([
    ["a", "private", next],
    ["b", "private", next],
    ["c", "private", next],
  ]);
  state.auditFailure = true;
  await expect(
    repo.applyVisibilityBatch("actor", { ...input, previewRevision: preview.previewRevision }, [
      "a1",
      "a2",
      "a3",
    ]),
  ).rejects.toThrow();
  state.auditFailure = false;
  state.queries = [];
  prepare();
  state.rows.push([
    ["a", "private", next],
    ["a", "private", next],
    ["c", "private", next],
  ]);
  await expect(
    repo.applyVisibilityBatch("actor", { ...input, previewRevision: preview.previewRevision }, [
      "a1",
      "a2",
      "a3",
    ]),
  ).rejects.toMatchObject({ code: "SERVER_BATCH_CHANGED" });
  expect(writes()).toHaveLength(1);
});
