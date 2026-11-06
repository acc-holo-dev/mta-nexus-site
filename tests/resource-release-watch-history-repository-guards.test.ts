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

it("keeps malformed or over-limit payloads neutral and skips metadata reads", async () => {
  state.rows = [
    [["usr_a"]],
    [{ observedAt: date }],
    [[1]],
    [event({ payload: { enabled: "true", revision: 2 } })],
  ];
  const result = await history("usr_a", query);
  expect(result.items[0]).toMatchObject({ source: "unknown", changes: null, collection: null });
  expect(state.queries).toHaveLength(4);
  const projection = state.queries.at(-1)?.sql ?? "";
  expect(projection).toContain("BETWEEN 1 AND 20");
  expect(projection).toContain("left(entry->>'productId',161)");
  expect(projection).toContain("jsonb_typeof");
});
it("requires a live account and rejects direct invalid scopes before querying", async () => {
  state.rows = [[]];
  await expect(history("usr_a", query)).rejects.toMatchObject({ statusCode: 404 });
  state.queries = [];
  await expect(history("usr_a", { ...query, page: 1001 })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
});
