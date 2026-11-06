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
  resourceReleaseWatchResumeRepositoryOutput as output,
  resourceReleaseWatchResumeRepositoryReady as ready,
  resourceReleaseWatchResumeRepositoryStamp as stamp,
  resourceReleaseWatchResumeRepositoryState as state,
  resourceReleaseWatchResumeRepositorySuccess as success,
} from "./helpers/resource-release-watch-resume-repository-harness";

installResourceReleaseWatchResumeRepositoryHooks();

it("rechecks finite access after all locks and enforces the account quota", async () => {
  const rows = ready();
  rows[5] = [["ent_a", stamp]];
  state.rows = [...rows, [[4]], [{ observedAt: stamp }]];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
  state.rows = [...ready(), [[99]]];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_LIMIT" });
});
it("rejects withdrawn or unsafe publication before resuming any selected watch", async () => {
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [
      ["prd_a", "draft"],
      ["prd_b", "published"],
    ],
  ];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
  state.rows = ready();
  state.rows[6] = [];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
});
it("propagates required audit failure and refuses partial upsert results", async () => {
  success();
  state.failAudit = true;
  await expect(resume(input)).rejects.toMatchObject({ cause: { message: "audit failed" } });
  state.failAudit = false;
  state.rows = [...ready(), [[4]], [{ observedAt: stamp }], [output[0]]];
  await expect(resume(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
});
it("rejects unreviewed new enrollment and injected collection authority before database work", async () => {
  for (const command of [
    { items: [{ productId: "prd_a", expectedRevision: 0 }] },
    { ...input.command, expectedCollectionRevision: 1 },
  ])
    await expect(resume({ ...input, command })).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});

it("revalidates the initiating session before returning an already resumed batch", async () => {
  state.sessionLive = false;
  state.rows = ready([
    ["prd_a", true, 2, stamp],
    ["prd_b", true, 4, stamp],
  ]);
  await expect(resume(input)).rejects.toMatchObject({ statusCode: 401 });
  expect(state.queries.at(-2)?.sql).toContain("for no key update");
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
});
