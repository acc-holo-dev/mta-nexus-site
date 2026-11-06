import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReleaseWatchHistoryRepositoryDbMock } = await import(
    "./helpers/resource-release-watch-history-repository-harness"
  );
  return createResourceReleaseWatchHistoryRepositoryDbMock();
});

import { readResourceReleaseWatchHistory as history } from "../packages/db/src/repositories/resource-release-watch-history";
import {
  installResourceReleaseWatchHistoryRepositoryHooks,
  resourceReleaseWatchHistoryRepositoryDate as date,
  resourceReleaseWatchHistoryRepositoryEvent as event,
  resourceReleaseWatchHistoryRepositoryQuery as query,
  resourceReleaseWatchHistoryRepositoryState as state,
} from "./helpers/resource-release-watch-history-repository-harness";

installResourceReleaseWatchHistoryRepositoryHooks();

it("reads only session actor commands in one database-time snapshot and batches current metadata lookup", async () => {
  state.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [event()],
    [
      {
        productId: "prd_a",
        available: true,
        title: "Current",
        enabled: false,
        revision: 3,
        lastSequence: "SECRET-CURSOR",
      },
    ],
  ];
  const result = await history("usr_a", query);
  expect(result).toMatchObject({
    generatedAt: date,
    items: [
      {
        source: "individual",
        changes: [
          {
            productId: "prd_a",
            enabled: true,
            revision: 2,
            currentTitle: "Current",
            currentWatch: { enabled: false, revision: 3 },
          },
        ],
      },
    ],
  });
  expect(JSON.stringify(result)).not.toContain("SECRET");
  expect(state.queries).toHaveLength(5);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const text = state.queries.map((row) => row.sql).join("\n");
  expect(text).toContain("transaction_timestamp()");
  expect(text).toContain(`"audit_events"."actor_type"='user'`);
  expect(text).toContain(" IN ('library.release_watch_changed'");
  expect(text).not.toMatch(
    /ip_address|user_agent|last_sequence|storage_key|for share|insert into|update /u,
  );
});
it("retains recorded IDs but masks names after grant loss and avoids per-resource queries", async () => {
  state.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [
      event({
        action: "library.release_watches_disabled",
        targetId: "usr_a",
        payload: {
          changedCount: 2,
          items: [
            { productId: "prd_a", revision: 2 },
            { productId: "prd_b", revision: 3 },
          ],
        },
      }),
    ],
    [
      { productId: "prd_a", available: false, title: "PRIVATE-TITLE", enabled: false, revision: 2 },
      {
        productId: "prd_b",
        available: false,
        title: "PRIVATE-TITLE",
        enabled: null,
        revision: null,
      },
    ],
  ];
  const result = await history("usr_a", { ...query, productId: "prd_a", source: "batch" });
  expect(result.items[0].changes).toHaveLength(2);
  expect(result.items[0].changes?.every((row) => row.currentTitle === null)).toBe(true);
  expect(JSON.stringify(result)).not.toContain("PRIVATE-TITLE");
  expect(state.queries).toHaveLength(5);
  expect(state.queries[2].sql).toContain("jsonb_array_elements");
  expect(state.queries[2].params).toContain("prd_a");
  expect(state.queries[2].params).toContain("library.release_watches_disabled");
});
it("includes resume operations in the own-user batch filter without widening target authority", async () => {
  state.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [
      event({
        action: "library.release_watches_resumed",
        targetId: "usr_a",
        payload: { changedCount: 1, items: [{ productId: "prd_a", revision: 3 }] },
      }),
    ],
    [],
  ];
  const result = await history("usr_a", { ...query, source: "batch" });
  expect(result.items[0]).toMatchObject({
    source: "batch",
    changes: [{ productId: "prd_a", enabled: true }],
  });
  expect(state.queries[2].params).toContain("library.release_watches_resumed");
  expect(state.queries[2].sql).toContain(`"audit_events"."target_type"`);
  expect(state.queries[2].sql).toContain(`"audit_events"."target_id"=`);
});
