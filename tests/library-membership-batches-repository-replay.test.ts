import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryMembershipBatchesRepositoryDbMock } = await import(
    "./helpers/library-membership-batches-repository-harness"
  );
  return createLibraryMembershipBatchesRepositoryDbMock();
});

vi.mock("../packages/db/src/repositories/library-collection-command", async (original) => {
  const { libraryMembershipBatchesRepositoryState } = await import(
    "./helpers/library-membership-batches-repository-harness"
  );
  return {
    ...(await original<
      typeof import("../packages/db/src/repositories/library-collection-command")
    >()),
    prepareLibraryCollectionCommand: async (...args: unknown[]) => {
      const result = await libraryMembershipBatchesRepositoryState.apply(...args);
      return { replayed: result.replayed, write: async () => result };
    },
  };
});

import { applyLibraryMembershipBatch } from "../packages/db/src/repositories/library-membership-batches";
import {
  installLibraryMembershipBatchesRepositoryHooks,
  libraryMembershipBatchesRepositoryChange as change,
  libraryMembershipBatchesRepositoryDate as date,
  libraryMembershipBatchesRepositoryDigest as digest,
  libraryMembershipBatchesRepositoryInput as input,
  libraryMembershipBatchesRepositoryRecordRow as recordRow,
  libraryMembershipBatchesRepositoryRequestId as requestId,
  libraryMembershipBatchesRepositoryState as state,
  libraryMembershipBatchesRepositoryText as sqlText,
} from "./helpers/library-membership-batches-repository-harness";

installLibraryMembershipBatchesRepositoryHooks();

it("replays immutable child results after later edits without checking access or mutating", async () => {
  const i = input(),
    childUUID = "77ca0352-de64-4af9-9e54-7d3c56fe8d89",
    cmd = { requestId: childUUID, action: "remove", expectedRevision: 2, productId: "prd_a" };
  const record = {
    id: "lmb_a",
    userId: i.userId,
    requestId,
    productId: i.productId,
    commandDigest: digest(i.productId, i.command),
    command: i.command,
    childReceiptIds: ["lcr_0"],
    createdAt: date,
  };
  state.rows = [
    [],
    [],
    [],
    [["usr_a"]],
    [recordRow(record)],
    [
      [
        "lcr_0",
        childUUID,
        cmd,
        { id: "lcol_a", name: "Core", status: "active", revision: 3 },
        date,
      ],
    ],
  ];
  expect(await applyLibraryMembershipBatch(i)).toMatchObject({
    replayed: true,
    receipt: { children: [{ collection: { revision: 3 } }] },
  });
  expect(state.apply).not.toHaveBeenCalled();
  expect(sqlText()).not.toMatch(/insert into|update |delete from/iu);
  expect(sqlText()).toContain('"library_collections"."user_id"');
});

it("rejects invalid commands/identities before opening a transaction and binds replay to the resource", async () => {
  await expect(
    applyLibraryMembershipBatch(input([{ ...change, inCollection: true }])),
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(applyLibraryMembershipBatch({ ...input(), children: [] })).rejects.toMatchObject({
    code: "COLLECTION_BATCH_INVALID",
  });
  expect(state.queries).toHaveLength(0);
});

it("rejects using the same own parent UUID for another resource before accessing children", async () => {
  const record = {
    id: "lmb_a",
    userId: "usr_a",
    requestId,
    productId: "prd_other",
    commandDigest: "a".repeat(64),
    command: input().command,
    childReceiptIds: ["lcr_0"],
    createdAt: date,
  };
  state.rows = [[], [], [], [["usr_a"]], [recordRow(record)]];
  await expect(applyLibraryMembershipBatch(input())).rejects.toMatchObject({
    code: "COLLECTION_REQUEST_REUSED",
  });
  expect(state.apply).not.toHaveBeenCalled();
  expect(state.queries).toHaveLength(5);
});
