import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryMembershipHistoryRepositoryDbMock } = await import(
    "./helpers/library-membership-history-repository-harness"
  );
  return createLibraryMembershipHistoryRepositoryDbMock();
});

import {
  readLibraryMembershipHistory,
  readLibraryMembershipHistoryDetail,
} from "../packages/db/src/repositories/library-membership-history";
import {
  installLibraryMembershipHistoryRepositoryHooks,
  libraryMembershipHistoryRepositoryChild as child,
  libraryMembershipHistoryRepositoryParent as parent,
  libraryMembershipHistoryRepositoryPrefix as prefix,
  libraryMembershipHistoryRepositoryQuery as query,
  libraryMembershipHistoryRepositoryState as state,
} from "./helpers/library-membership-history-repository-harness";

installLibraryMembershipHistoryRepositoryHooks();

it("stable own detail survives missing current resource and final reference removal without scope expansion", async () => {
  state.rows = [...prefix(), [parent()], [child(0), child(1)], [], []];
  const detail = await readLibraryMembershipHistoryDetail("usr_a", "lmb_a");
  expect(detail.item.receipt?.id).toBe("lmb_a");
  expect(detail.item.resource?.currentTitle).toBeNull();
  expect(detail.item.collections.every((row) => row.current === null)).toBe(true);
  expect(state.queries[2]?.params).toEqual(["usr_a", "lmb_a", 1]);
  expect(state.queries).toHaveLength(6);
});

it("rejects foreign/unknown details and deleted actors before child or product inspection", async () => {
  state.rows = [...prefix(), []];
  await expect(readLibraryMembershipHistoryDetail("usr_a", "lmb_foreign")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(3);
  state.queries = [];
  state.rows = [[]];
  await expect(readLibraryMembershipHistory("usr_deleted", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});

it("validates bounds before SQL and refuses invalid clocks", async () => {
  for (const change of [
    { page: 10000 },
    { days: 31 },
    { operation: "delete" },
    { collectionId: "../private" },
  ])
    await expect(
      readLibraryMembershipHistory("usr_a", { ...query, ...change } as typeof query),
    ).rejects.toMatchObject({ statusCode: 400 });
  await expect(readLibraryMembershipHistoryDetail("usr_a", "../private")).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
  state.rows = [[["usr_a"]], [{ observedAt: "invalid" }]];
  await expect(readLibraryMembershipHistory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});

it("handles empty history without child or current-state queries", async () => {
  state.rows = [...prefix(), [[0]], []];
  expect(await readLibraryMembershipHistory("usr_a", query)).toMatchObject({
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  expect(state.queries).toHaveLength(4);
});
