import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createCollectionReleaseWatchesRepositoryDbMock } = await import(
    "./helpers/collection-release-watches-repository-harness"
  );
  return createCollectionReleaseWatchesRepositoryDbMock();
});

import {
  enableCollectionReleaseWatches as enable,
  readCollectionReleaseWatches as page,
} from "../packages/db/src/repositories/collection-release-watches";
import {
  collectionReleaseWatchesRepositoryInput as input,
  collectionReleaseWatchesRepositoryState as state,
  installCollectionReleaseWatchesRepositoryHooks,
} from "./helpers/collection-release-watches-repository-harness";

installCollectionReleaseWatchesRepositoryHooks();

it("reads only an owner's collection in a masked, bounded database-time snapshot", async () => {
  state.rows = [
    [["usr_a"]],
    [["lcol_a", "Core", "archived", 3]],
    [{ all: 1, enabled: 0, disabled: 1, unavailable: 1, activeWatchCount: 4 }],
    [
      {
        productId: "prd_a",
        enabled: false,
        revision: 0,
        updatedAt: null,
        available: false,
        title: "PRIVATE-TITLE",
        lastSequence: "PRIVATE-CURSOR",
      },
    ],
  ];
  const result = await page("usr_a", "lcol_a", 1, "all", "Core");
  expect(result).toMatchObject({
    collection: { status: "archived" },
    activeWatchCount: 4,
    items: [{ title: null, updatedAt: null }],
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  const text = state.queries.map((q) => q.sql).join("\n");
  expect(text).toContain("transaction_timestamp()");
  expect(text).toContain("WHERE available AND title ILIKE");
  expect(text).toContain("watch.user_id=");
  expect(text).not.toMatch(/for share|last_sequence|storage_key/u);
});
it("rejects foreign collections and malformed direct commands before granting any watch", async () => {
  state.rows = [[["usr_a"]], []];
  await expect(page("usr_a", "lcol_other")).rejects.toMatchObject({ statusCode: 404 });
  state.queries = [];
  await expect(
    enable({ ...input, command: { ...input.command, expectedCollectionRevision: 0 } }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});
