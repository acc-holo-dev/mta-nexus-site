import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

/** Shared mock state for library-collections HTTP suites. */
export const libraryCollectionsHttpState = {
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  command: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  history: vi.fn(),
  copyPreview: vi.fn(),
  copyItemsPage: vi.fn(),
  releases: vi.fn(),
  resourceMemberships: vi.fn(),
  accountHistory: vi.fn(),
  comparison: vi.fn(),
  membershipBatch: vi.fn(),
  inventory: vi.fn(),
  receiptDetail: vi.fn(),
  exportManifest: vi.fn(),
  importPreview: vi.fn(),
  membershipHistory: vi.fn(),
  membershipReceipt: vi.fn(),
};

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/unit` or `tests/database`. */
export function createLibraryCollectionsHttpDbMock() {
  const state = libraryCollectionsHttpState;
  return {
    readLibraryCollectionHistory: state.accountHistory,
    readLibraryCollectionComparison: state.comparison,
    applyLibraryMembershipBatch: state.membershipBatch,
    readLibraryCollectionInventory: state.inventory,
    readLibraryCollectionReceiptDetail: state.receiptDetail,
    exportLibraryCollection: state.exportManifest,
    previewLibraryCollectionImport: state.importPreview,
    readLibraryMembershipHistory: state.membershipHistory,
    readLibraryMembershipHistoryDetail: state.membershipReceipt,
    libraryCollectionsRepository: {
      command: state.command,
      page: state.page,
      detail: state.detail,
      history: state.history,
      copyPreview: state.copyPreview,
      copyItemsPage: state.copyItemsPage,
      releases: state.releases,
      resourceMemberships: state.resourceMemberships,
    },
  };
}

export const libraryCollectionsHttpContext = { params: Promise.resolve({ id: "lcol_a" }) };
export const libraryCollectionsHttpBase = "/api/library/collections";
export const libraryCollectionsHttpRequestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";

export function libraryCollectionsHttpRequest(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return new NextRequest(`https://nexus.test${path}`, init);
}

export function libraryCollectionsHttpPost(
  body: unknown = {
    requestId: libraryCollectionsHttpRequestId,
    action: "create",
    name: "Core",
  },
  path = libraryCollectionsHttpBase,
  headers: Record<string, string> = {},
) {
  return libraryCollectionsHttpRequest(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=raw-browser-token",
      "x-nexus-actor-id": "usr_a",
      ...headers,
    },
  });
}

function resetLibraryCollectionsHttpState() {
  const state = libraryCollectionsHttpState;
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: true });
  state.command.mockResolvedValue({ receipt: { id: "lcr_a" }, replayed: false });
  state.page.mockResolvedValue({ items: [] });
  state.detail.mockResolvedValue({ items: [] });
  state.history.mockResolvedValue({ items: [] });
  state.releases.mockResolvedValue({
    items: [],
    collection: { id: "lcol_a" },
    generatedAt: "2026-10-12T00:00:00.000Z",
  });
  state.copyPreview.mockResolvedValue({
    source: { id: "lcol_a", name: "Core", status: "active", revision: 4 },
    itemCount: 200,
    sourceDigest: "a".repeat(64),
  });
}

/** Shared auth/rate-limit/env lifecycle for every library-collections HTTP suite. */
export function installLibraryCollectionsHttpLifecycle() {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  beforeEach(resetLibraryCollectionsHttpState);
}
