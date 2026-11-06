import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReleaseWatchResumeRepositoryDbMock } = await import(
    "./helpers/resource-release-watch-resume-repository-harness"
  );
  return createResourceReleaseWatchResumeRepositoryDbMock();
});

import { resumeResourceReleaseWatches as resume } from "../packages/db/src/repositories/collection-release-watches";
import {
  installResourceReleaseWatchResumeRepositoryHooks,
  resourceReleaseWatchResumeRepositoryInput as input,
  resourceReleaseWatchResumeRepositoryReady as ready,
  resourceReleaseWatchResumeRepositoryStamp as stamp,
  resourceReleaseWatchResumeRepositoryState as state,
  resourceReleaseWatchResumeRepositorySuccess as success,
} from "./helpers/resource-release-watch-resume-repository-harness";

installResourceReleaseWatchResumeRepositoryHooks();

it("resumes only the reviewed existing stopped watches through the shared baseline enrollment transaction", async () => {
  success();
  const result = await resume(input);
  expect(result).toMatchObject({
    changedCount: 2,
    items: [
      { productId: "prd_a", enabled: true, revision: 2 },
      { productId: "prd_b", enabled: true, revision: 4 },
    ],
  });
  const text = state.queries.map((q) => q.sql).join("\n");
  expect(text).toContain("pg_advisory_xact_lock");
  expect(text).toContain("for no key update");
  expect(text).toContain("clock_timestamp()");
  expect(text).toContain("max(");
  expect(text).toContain("greatest(");
  expect(text).toContain("excluded.revision-1");
  expect(text).not.toContain("library_collection");
  expect(state.queries.at(-1)?.params).toContain("library.release_watches_resumed");
  expect(state.queries.at(-1)?.params).toContain("usr_a");
  expect(JSON.stringify(result)).not.toContain("lastSequence");
});
it("does not enroll an absent or foreign watch", async () => {
  state.rows = ready([["prd_a", false, 1, stamp]]);
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.includes("INSERT INTO"))).toBe(false);
});
it("confirms only a complete successor state without a second write or audit", async () => {
  state.rows = [
    ...ready([
      ["prd_a", true, 2, stamp],
      ["prd_b", true, 4, stamp],
    ]),
    [{ observedAt: stamp }],
  ];
  expect(await resume(input)).toMatchObject({ changedCount: 0 });
  expect(
    state.queries.some((q) => q.sql.includes("INSERT INTO") || q.sql.startsWith("insert")),
  ).toBe(false);
});
it.each([
  {
    previous: [
      ["prd_a", true, 2, stamp],
      ["prd_b", false, 3, stamp],
    ],
  },
  {
    previous: [
      ["prd_a", false, 9, stamp],
      ["prd_b", false, 3, stamp],
    ],
  },
])("rejects mixed retry states or stale revisions as one batch", async ({ previous }) => {
  state.rows = ready(previous);
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
});
