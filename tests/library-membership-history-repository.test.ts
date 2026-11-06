import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryMembershipHistoryRepositoryDbMock } = await import(
    "./helpers/library-membership-history-repository-harness"
  );
  return createLibraryMembershipHistoryRepositoryDbMock();
});

import { readLibraryMembershipHistory } from "../packages/db/src/repositories/library-membership-history";
import {
  installLibraryMembershipHistoryRepositoryHooks,
  libraryMembershipHistoryRepositoryChild as child,
  libraryMembershipHistoryRepositoryCommand as command,
  libraryMembershipHistoryRepositoryDate as date,
  libraryMembershipHistoryRepositoryDigest as digest,
  libraryMembershipHistoryRepositoryParent as parent,
  libraryMembershipHistoryRepositoryPrefix as prefix,
  libraryMembershipHistoryRepositoryQuery as query,
  libraryMembershipHistoryRepositoryRequestId as requestId,
  libraryMembershipHistoryRepositoryState as state,
  libraryMembershipHistoryRepositoryText as text,
} from "./helpers/library-membership-history-repository-harness";

installLibraryMembershipHistoryRepositoryHooks();

it("preserves whole immutable group evidence while separating current own memberships and masked labels", async () => {
  state.rows = [
    ...prefix(),
    [[1]],
    [parent()],
    [child(0), child(1)],
    [
      {
        collectionId: "lcol_a",
        productId: "prd_a",
        id: "lcol_a",
        name: "Later name",
        status: "archived",
        revision: 9,
        inCollection: true,
      },
      {
        collectionId: "lcol_b",
        productId: "prd_a",
        id: "lcol_b",
        name: "Current B",
        status: "active",
        revision: 7,
        inCollection: false,
      },
    ],
    [{ productId: "prd_a", title: "PRIVATE", available: false, storageKey: "PRIVATE" }],
  ];
  const report = await readLibraryMembershipHistory("usr_a", {
    ...query,
    page: 9999,
    operation: "mixed",
    collectionId: "lcol_b",
    productId: "prd_a",
  });
  expect(report.page).toBe(1);
  expect(report.items[0]?.receipt?.children).toHaveLength(2);
  expect(report.items[0]?.receipt?.children[0]?.collection).toMatchObject({
    name: "Recorded & name",
    revision: 3,
    status: "active",
  });
  expect(report.items[0]?.collections[0]).toMatchObject({
    current: { name: "Later name", revision: 9, status: "archived" },
    inCollection: true,
  });
  expect(report.items[0]?.resource).toEqual({
    productId: "prd_a",
    currentTitle: null,
    currentAvailable: false,
  });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries).toHaveLength(7);
  expect(state.queries[2]?.params).toContain("usr_a");
  expect(state.queries[2]?.params).toContain('[{"collectionId":"lcol_b"}]');
  expect(state.queries[4]?.params).toContain("usr_a");
  expect(state.queries[4]?.params.at(-1)).toBe(400);
  expect(state.queries[5]?.params).toContain("usr_a");
  expect(text()).toContain('refs."productId"');
  expect(text()).toContain("transaction_timestamp()");
  expect(text()).toContain("'product.download'");
  expect(text()).toContain("'published'");
  expect(state.queries[6]?.params).toContain("clean");
  expect(text()).not.toMatch(/insert into|update |delete from|for update/iu);
});

it("binds current membership to both collection and resource across different groups", async () => {
  state.rows = [
    ...prefix(),
    [[2]],
    [parent(), parent(command, digest("prd_b"), "prd_b", "lmb_b")],
    [child(0), child(1)],
    [],
    [],
  ];
  // The second group cannot borrow children belonging to another resource.
  const report = await readLibraryMembershipHistory("usr_a", query);
  expect(report.items[1]?.receipt).toBeNull();
  const references = state.queries[5]?.params.find(
    (value) => typeof value === "string" && value.includes('"collectionId"'),
  );
  expect(references).toBe(
    '[{"collectionId":"lcol_a","productId":"prd_a"},{"collectionId":"lcol_b","productId":"prd_a"}]',
  );
});

it.each(["digest", "hidden", "future", "oversized", "association"])(
  "does not expand invalid parent evidence %s",
  async (kind) => {
    const row = parent();
    if (kind === "digest") row[3] = "0".repeat(64);
    if (kind === "hidden") row[4] = { ...command, storageKey: "PRIVATE" };
    if (kind === "future") row[4] = { requestId, action: "future" };
    if (kind === "oversized") row[5] = Array.from({ length: 21 }, (_, i) => `lcr_${i}`);
    if (kind === "association") row[5] = ["lcr_a", "lcr_a"];
    state.rows = [...prefix(), [[1]], [row]];
    const report = await readLibraryMembershipHistory("usr_a", query);
    expect(report.items[0]).toEqual({
      id: "lmb_a",
      createdAt: date,
      receipt: null,
      resource: null,
      collections: [],
    });
    expect(state.queries).toHaveLength(4);
    expect(JSON.stringify(report)).not.toContain("PRIVATE");
  },
);

it.each(["missing", "identity", "revision", "action", "uuid", "hidden"])(
  "refuses partial or contradictory child evidence %s",
  async (kind) => {
    const a = child(0),
      b = child(1);
    if (kind === "identity") a[2] = "lcol_foreign";
    if (kind === "revision")
      a[4] = { id: "lcol_a", name: "Recorded", status: "active", revision: 99 };
    if (kind === "action") a[3] = { ...(a[3] as object), action: "add" };
    if (kind === "uuid") a[1] = requestId;
    if (kind === "hidden") a[3] = { ...(a[3] as object), ownerId: "PRIVATE" };
    state.rows = [...prefix(), [[1]], [parent()], kind === "missing" ? [a] : [a, b]];
    expect((await readLibraryMembershipHistory("usr_a", query)).items[0]?.receipt).toBeNull();
    expect(state.queries).toHaveLength(5);
  },
);

it("uses resource-specific current membership when two valid groups share a collection", async () => {
  const otherRequest = "97ca0352-de64-4af9-9e54-7d3c56fe8d89",
    otherCommand = { ...command, requestId: otherRequest };
  const second = [
    "lmb_b",
    otherRequest,
    "prd_b",
    digest("prd_b", otherCommand),
    otherCommand,
    ["lcr_c", "lcr_d"],
    date,
  ];
  const c = child(0, "prd_b"),
    d = child(1, "prd_b");
  c[0] = "lcr_c";
  d[0] = "lcr_d";
  state.rows = [
    ...prefix(),
    [[2]],
    [parent(), second],
    [child(0), child(1), c, d],
    [
      {
        collectionId: "lcol_a",
        productId: "prd_a",
        id: "lcol_a",
        name: "Now",
        status: "active",
        revision: 9,
        inCollection: false,
      },
      {
        collectionId: "lcol_a",
        productId: "prd_b",
        id: "lcol_a",
        name: "Now",
        status: "active",
        revision: 9,
        inCollection: true,
      },
    ],
    [
      { productId: "prd_a", title: "Available", available: true },
      { productId: "prd_b", title: "PRIVATE", available: false },
    ],
  ];
  const report = await readLibraryMembershipHistory("usr_a", query);
  expect(report.items.every((item) => item.receipt !== null)).toBe(true);
  expect(report.items[0]?.collections[0]?.inCollection).toBe(false);
  expect(report.items[1]?.collections[0]?.inCollection).toBe(true);
  expect(report.items[0]?.resource?.currentTitle).toBe("Available");
  expect(report.items[1]?.resource?.currentTitle).toBeNull();
});
