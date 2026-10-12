import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { recordedResourceReleaseWatchOperation as parse } from "@nexus/domain";
import { resourceReleaseWatchHistoryQuery as query } from "../apps/web/src/lib/resource-release-watch-history-query";
it("projects individual and complete batch operations without coercing recorded states", () => {
  expect(
    parse("library.release_watch_changed", "prd_a", {
      enabled: false,
      revision: 2,
      private: "SECRET",
    }),
  ).toEqual({
    source: "individual",
    changes: [{ productId: "prd_a", enabled: false, revision: 2 }],
    collection: null,
  });
  const payload = {
    items: [
      { productId: "prd_b", revision: 3 },
      { productId: "prd_a", revision: 1 },
    ],
    changedCount: 2,
    collectionRevision: 4,
  };
  expect(parse("library.release_watches_disabled", "usr_a", payload)).toMatchObject({
    source: "batch",
    changes: [
      { productId: "prd_a", enabled: false },
      { productId: "prd_b", enabled: false },
    ],
  });
  expect(parse("library.collection_release_watches_enabled", "lcol_a", payload)).toMatchObject({
    source: "collection",
    collection: { id: "lcol_a", revision: 4 },
    changes: [{ enabled: true }, { enabled: true }],
  });
  for (const invalid of [
    { enabled: "false", revision: 2 },
    { enabled: false, revision: "2" },
    { enabled: false, revision: 0 },
    { enabled: false, revision: 1.5 },
  ])
    expect(parse("library.release_watch_changed", "prd_a", invalid).source).toBe("unknown");
});
it("invalid batch evidence remains unknown instead of showing a partial or invented stop", () => {
  const payload = {
    items: [{ productId: "prd_a", revision: 1 }],
    changedCount: 1,
    collectionRevision: 3,
  };
  for (const bad of [
    { ...payload, changedCount: 0 },
    { ...payload, items: [...payload.items, ...payload.items], changedCount: 2 },
    { ...payload, items: [{ productId: "../private", revision: 1 }] },
    { ...payload, collectionRevision: 0 },
    {
      ...payload,
      items: Array.from({ length: 21 }, (_, i) => ({ productId: `prd_${i}`, revision: 1 })),
      changedCount: 21,
    },
  ]) {
    expect(parse("library.collection_release_watches_enabled", "lcol_a", bad)).toEqual({
      source: "unknown",
      changes: null,
      collection: null,
    });
  }
});
it("strictly parses period, source and recorded-resource filters", () => {
  expect(query(new URLSearchParams("days=90&source=batch&productId=prd_a&page=2"))).toEqual({
    days: 90,
    source: "batch",
    productId: "prd_a",
    page: 2,
  });
  for (const value of [
    "source=private",
    "source=batch&source=all",
    "actorId=other",
    "days=31",
    "page=1001",
    "productId=../private",
    "page=1&page=2",
  ])
    expect(() => query(new URLSearchParams(value))).toThrow();
});
it("registers a literal own-watch audit index suitable for prepared history queries", () => {
  const sql = readFileSync("packages/db/migrations/0072_release_watch_history_index.sql", "utf8");
  expect(sql).toContain("actor_id,created_at DESC,id DESC");
  expect(sql).toContain("actor_type='user'");
  for (const action of [
    "library.release_watch_changed",
    "library.release_watches_disabled",
    "library.collection_release_watches_enabled",
  ])
    expect(sql).toContain(action);
  const journal = JSON.parse(readFileSync("packages/db/migrations/meta/_journal.json", "utf8"));
  expect(
    journal.entries.filter(
      (entry: { tag: string }) => entry.tag === "0072_release_watch_history_index",
    ),
  ).toHaveLength(1);
});

it("records group resume as enabled batch changes and indexes the expanded literal predicate", () => {
  const value = parse("library.release_watches_resumed", "usr_a", {
    changedCount: 1,
    items: [{ productId: "prd_a", revision: 3 }],
  });
  expect(value).toEqual({
    source: "batch",
    changes: [{ productId: "prd_a", enabled: true, revision: 3 }],
    collection: null,
  });
  const migration = readFileSync(
    "packages/db/migrations/0073_release_watch_resume_history.sql",
    "utf8",
  );
  expect(migration).toContain("DROP INDEX audit_events_release_watch_history_idx");
  expect(migration).toContain("library.release_watches_resumed");
  const journal = JSON.parse(readFileSync("packages/db/migrations/meta/_journal.json", "utf8"));
  expect(
    journal.entries.filter(
      (entry: { tag: string }) => entry.tag === "0073_release_watch_resume_history",
    ),
  ).toHaveLength(1);
});
