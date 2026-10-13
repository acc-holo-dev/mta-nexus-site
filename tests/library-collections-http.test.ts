import { GET as receiptDetail } from "../apps/web/src/app/api/library/collections/receipts/[id]/route";
import { GET as receiptExport } from "../apps/web/src/app/api/library/collections/receipts/[id]/export/route";
import { POST as reconcilePreview } from "../apps/web/src/app/api/library/collections/[id]/reconcile-preview/route";
import { GET as exportManifest } from "../apps/web/src/app/api/library/collections/[id]/export/route";
import { POST as importPreview } from "../apps/web/src/app/api/library/collections/[id]/import-preview/route";
import { GET as membershipHistory } from "../apps/web/src/app/api/library/collections/membership-history/route";
import { GET as membershipHistoryExport } from "../apps/web/src/app/api/library/collections/membership-history/export/route";
import { GET as membershipReceipt } from "../apps/web/src/app/api/library/collections/membership-history/[id]/route";
import { GET as comparison } from "../apps/web/src/app/api/library/collections/[id]/compare/route";
import { GET as accountHistory } from "../apps/web/src/app/api/library/collections/history/route";
import { GET as historyExport } from "../apps/web/src/app/api/library/collections/history/export/route";
import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
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
  receiptDetail: vi.fn(),
  exportManifest: vi.fn(),
  importPreview: vi.fn(),
  membershipHistory: vi.fn(),
  membershipReceipt: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: state.rate,
  generateId: (prefix: string) => `${prefix}_a`,
}));
vi.mock("@nexus/db", () => ({
  readLibraryCollectionHistory: state.accountHistory,
  readLibraryCollectionComparison: state.comparison,
  applyLibraryMembershipBatch: state.membershipBatch,
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
}));

import { GET as releases } from "../apps/web/src/app/api/library/collections/[id]/releases/route";
import {
  POST as membershipBatch,
  GET as resourceMemberships,
} from "../apps/web/src/app/api/library/[id]/collections/route";
import { GET as releasesExport } from "../apps/web/src/app/api/library/collections/[id]/releases/export/route";
import { GET as moveItemsPage } from "../apps/web/src/app/api/library/collections/[id]/move-items/route";
import { GET as copyItemsPage } from "../apps/web/src/app/api/library/collections/[id]/copy-items/route";
import { GET as copyPreview } from "../apps/web/src/app/api/library/collections/[id]/copy/route";
import { GET as candidates } from "../apps/web/src/app/api/library/collections/[id]/candidates/route";
import { GET as history } from "../apps/web/src/app/api/library/collections/[id]/history/route";
import {
  POST as command,
  GET as detail,
} from "../apps/web/src/app/api/library/collections/[id]/route";
import { POST as create, GET as list } from "../apps/web/src/app/api/library/collections/route";

const context = { params: Promise.resolve({ id: "lcol_a" }) },
  base = "/api/library/collections",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";
const request = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`https://nexus.test${path}`, init);
const post = (
  body: unknown = { requestId, action: "create", name: "Core" },
  path = base,
  headers: Record<string, string> = { "content-type": "application/json" },
) => request(path, { method: "POST", body: JSON.stringify(body), headers });
beforeEach(() => {
  vi.clearAllMocks();
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
});
it("requires a signed-in account for all six private operations", async () => {
  state.actor = null;
  for (const [handler, path] of [
    [list, base],
    [detail, `${base}/lcol_a`],
    [candidates, `${base}/lcol_a/candidates`],
    [history, `${base}/lcol_a/history`],
  ] as const)
    expect((await handler(request(path), context)).status).toBe(401);
  expect((await create(post())).status).toBe(401);
  expect((await command(post({}, `${base}/lcol_a`), context)).status).toBe(401);
  expect(state.command).not.toHaveBeenCalled();
});
it("fixes actor identity and returns private uncached records", async () => {
  const response = await create(post());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.command).toHaveBeenCalledWith({
    userId: "usr_a",
    command: { requestId, action: "create", name: "Core" },
    collectionId: undefined,
    newCollectionId: "lcol_a",
    receiptId: "lcr_a",
    auditId: "aud_a",
  });
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
});
it("scopes reads and pagination to the account, not body or query identities", async () => {
  expect((await list(request(`${base}?page=2&status=archived`))).status).toBe(200);
  expect(state.page).toHaveBeenCalledWith("usr_a", 2, "archived");
  expect(
    (await candidates(request(`${base}/lcol_a/candidates?page=3&q=core`), context)).status,
  ).toBe(200);
  expect(state.detail).toHaveBeenCalledWith("usr_a", "lcol_a", 3, "core", true);
  expect((await history(request(`${base}/lcol_a/history?page=2`), context)).status).toBe(200);
  expect(state.history).toHaveBeenCalledWith("usr_a", "lcol_a", 2);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
});
it.each(["userId", "organizationId", "permission", "price", "status", "entitlement"])(
  "rejects body override %s",
  async (field) => {
    expect(
      (await create(post({ requestId, action: "create", name: "Core", [field]: "other" }))).status,
    ).toBe(400);
    expect(state.command).not.toHaveBeenCalled();
  },
);
it("forbids create commands on existing ids and resource commands on collection root", async () => {
  expect((await command(post(undefined, `${base}/lcol_a`), context)).status).toBe(400);
  expect(
    (await create(post({ requestId, action: "add", expectedRevision: 1, productId: "prd_a" })))
      .status,
  ).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("rejects cross-site mutations, wrong content types and oversized bodies", async () => {
  expect(
    (
      await create(
        post(undefined, base, {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        }),
      )
    ).status,
  ).toBe(403);
  expect((await create(post(undefined, base, { "content-type": "text/plain" }))).status).toBe(415);
  expect((await create(post({ requestId, action: "create", name: "x".repeat(3000) }))).status).toBe(
    413,
  );
  expect(state.command).not.toHaveBeenCalled();
});
it("rejects unknown, duplicate and mutation query controls", async () => {
  for (const [handler, path] of [
    [list, base],
    [detail, `${base}/lcol_a`],
    [candidates, `${base}/lcol_a/candidates`],
    [history, `${base}/lcol_a/history`],
  ] as const) {
    expect((await handler(request(`${path}?userId=other`), context)).status).toBe(400);
    expect((await handler(request(`${path}?page=1&page=2`), context)).status).toBe(400);
  }
  expect((await create(post(undefined, `${base}?page=1`))).status).toBe(400);
  expect((await command(post({}, `${base}/lcol_a?userId=other`), context)).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("rate limits reads and commands before accessing data", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect((await create(post())).status).toBe(429);
  expect((await detail(request(`${base}/lcol_a`), context)).status).toBe(429);
  expect(state.command).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("returns conflicts and masked missing resources without internal fields", async () => {
  state.command.mockRejectedValue(
    new AppError("secret database detail", 409, "COLLECTION_CONFLICT"),
  );
  const response = await command(
    post(
      { requestId, action: "remove", productId: "prd_a", expectedRevision: 1 },
      `${base}/lcol_a`,
    ),
    context,
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "COLLECTION_CONFLICT" });
});
it("accepts a canonical private batch larger than the old body limit", async () => {
  const productIds = Array.from(
    { length: 20 },
    (_, i) => `prd_${String(i).padStart(2, "0")}_${"a".repeat(153)}`,
  ).reverse();
  const response = await command(
    post({ requestId, action: "add-many", productIds, expectedRevision: 2 }, `${base}/lcol_a`),
    context,
  );
  expect(response.status).toBe(200);
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "usr_a",
      collectionId: "lcol_a",
      command: {
        requestId,
        action: "add-many",
        productIds: [...productIds].sort(),
        expectedRevision: 2,
      },
    }),
  );
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("rejects oversized batches and injected ownership before repository writes", async () => {
  for (const body of [
    {
      requestId,
      action: "remove-many",
      expectedRevision: 2,
      productIds: Array.from({ length: 21 }, (_, i) => `prd_${i}`),
    },
    {
      requestId,
      action: "add-many",
      expectedRevision: 2,
      productIds: ["prd_a"],
      userId: "usr_other",
    },
    { requestId, action: "remove-many", expectedRevision: 2, productIds: ["prd_a", "prd_a"] },
  ])
    expect((await command(post(body, `${base}/lcol_a`), context)).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("authenticates and privately bounds complete copy previews", async () => {
  const path = `${base}/lcol_a/copy`;
  const response = await copyPreview(request(path), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toMatchObject({ source: { id: "lcol_a" }, itemCount: 200 });
  expect(state.copyPreview).toHaveBeenCalledWith("usr_a", "lcol_a");
  vi.clearAllMocks();
  expect((await copyPreview(request(`${path}?q=partial`), context)).status).toBe(400);
  expect(state.copyPreview).not.toHaveBeenCalled();
  state.actor = null;
  expect((await copyPreview(request(path), context)).status).toBe(401);
});
it("routes copies through creation only and binds authority to the session", async () => {
  const body = {
    requestId,
    action: "duplicate",
    name: "Independent copy",
    sourceCollectionId: "lcol_a",
    expectedRevision: 4,
    expectedItemCount: 200,
    sourceDigest: "a".repeat(64),
  };
  expect((await create(post(body))).status).toBe(200);
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "usr_a", collectionId: undefined, command: body }),
  );
  vi.clearAllMocks();
  expect((await command(post(body, `${base}/lcol_a`), context)).status).toBe(400);
  expect((await create(post({ ...body, userId: "usr_other" }))).status).toBe(400);
  expect(
    (
      await create(
        post(body, base, { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
      )
    ).status,
  ).toBe(403);
  expect(state.command).not.toHaveBeenCalled();
});
it("serves scoped private release inspection and bounded attachment exports", async () => {
  const path = `${base}/lcol_a/releases`;
  const response = await releases(request(`${path}?page=2&filter=updates&q=core`), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(state.releases).toHaveBeenCalledWith("usr_a", "lcol_a", 2, "updates", "core");
  const download = await releasesExport(request(`${path}/export`), context);
  expect(download.headers.get("content-disposition")).toContain("attachment");
  expect(download.headers.get("x-content-type-options")).toBe("nosniff");
  state.releases.mockResolvedValue({ text: "x".repeat(512 * 1024) });
  expect((await releasesExport(request(`${path}/export`), context)).status).toBe(413);
});
it("rejects unauthenticated, spoofed and over-rate release inspections before reading data", async () => {
  const path = `${base}/lcol_a/releases`;
  expect((await releases(request(`${path}?userId=other`), context)).status).toBe(400);
  expect(state.releases).not.toHaveBeenCalled();
  state.actor = null;
  expect((await releasesExport(request(`${path}/export`), context)).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await releases(request(path), context)).status).toBe(429);
  expect(state.releases).not.toHaveBeenCalled();
});

it("serves only session-bound private selected-copy pages and rejects arbitrary source selectors", async () => {
  state.copyItemsPage.mockResolvedValue({ items: [], destinations: [] });
  const response = await copyItemsPage(request(`${base}/lcol_a/copy-items?page=2&q=Core`), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.copyItemsPage).toHaveBeenCalledWith("usr_a", "lcol_a", 2, "Core");
  expect(
    (await copyItemsPage(request(`${base}/lcol_a/copy-items?userId=other`), context)).status,
  ).toBe(400);
  state.actor = null;
  expect((await copyItemsPage(request(`${base}/lcol_a/copy-items`), context)).status).toBe(401);
});
it("binds selected-reference copies to the destination route and validates source proof fields", async () => {
  const body = {
    requestId,
    action: "copy-items",
    sourceCollectionId: "lcol_source",
    expectedSourceRevision: 4,
    productIds: ["prd_a"],
    expectedRevision: 1,
  };
  expect((await command(post(body, `${base}/lcol_a`), context)).status).toBe(200);
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "usr_a", collectionId: "lcol_a", command: body }),
  );
  for (const bad of [
    { ...body, userId: "other" },
    { ...body, expectedSourceRevision: 0 },
    { ...body, sourceCollectionId: "../private" },
  ])
    expect((await command(post(bad, `${base}/lcol_a`), context)).status).toBe(400);
});

it("serves move review through the same private source snapshot and accepts only reviewed mutable source revisions", async () => {
  state.copyItemsPage.mockResolvedValue({
    source: { id: "lcol_a", status: "active", revision: 4 },
    items: [],
    destinations: [],
  });
  const response = await moveItemsPage(request(`${base}/lcol_a/move-items?page=2&q=Core`), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(state.copyItemsPage).toHaveBeenCalledWith("usr_a", "lcol_a", 2, "Core");
  const body = {
    requestId,
    action: "move-items",
    sourceCollectionId: "lcol_source",
    expectedSourceRevision: 4,
    productIds: ["prd_a"],
    expectedRevision: 1,
  };
  expect((await command(post(body, `${base}/lcol_a`), context)).status).toBe(200);
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "usr_a", collectionId: "lcol_a", command: body }),
  );
  expect(
    (
      await command(
        post({ ...body, expectedSourceRevision: 2147483647 }, `${base}/lcol_a`),
        context,
      )
    ).status,
  ).toBe(400);
  expect(
    (await moveItemsPage(request(`${base}/lcol_a/move-items?userId=other`), context)).status,
  ).toBe(400);
});

it("bounds resource collection inspection to the session and rejects every query selector", async () => {
  const path = "/api/library/prd_a/collections",
    params = { params: Promise.resolve({ id: "prd_a" }) };
  state.resourceMemberships.mockResolvedValue({
    schemaVersion: 1,
    resource: { productId: "prd_a", title: null, canAdd: false, available: false },
    collections: [],
  });
  const response = await resourceMemberships(request(path), params);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.resourceMemberships).toHaveBeenCalledWith("usr_a", "prd_a");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  vi.clearAllMocks();
  for (const query of [
    "userId=other",
    "page=1",
    "q=private",
    "status=active",
    "productId=other",
    "page=1&page=2",
  ])
    expect((await resourceMemberships(request(`${path}?${query}`), params)).status).toBe(400);
  expect(state.resourceMemberships).not.toHaveBeenCalled();
  state.actor = null;
  expect((await resourceMemberships(request(path), params)).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await resourceMemberships(request(path), params)).status).toBe(429);
  expect(state.resourceMemberships).not.toHaveBeenCalled();
});
it("masks unowned resource failures and rejects malformed resource ids before reading", async () => {
  const path = "/api/library/prd_a/collections";
  expect(
    (await resourceMemberships(request(path), { params: Promise.resolve({ id: "../private" }) }))
      .status,
  ).toBe(400);
  expect(state.resourceMemberships).not.toHaveBeenCalled();
  state.resourceMemberships.mockRejectedValue(
    new AppError("foreign resource title", 404, "NOT_FOUND"),
  );
  const response = await resourceMemberships(request(path), {
    params: Promise.resolve({ id: "prd_a" }),
  });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});

it("serves session-scoped whole collection commands and a bounded private attachment", async () => {
  const path =
    "/api/library/collections/history?days=90&action=move-items&productId=prd_a&collectionId=lcol_source&page=2";
  state.accountHistory.mockResolvedValue({ items: [], schemaVersion: 1 });
  const response = await accountHistory(request(path));
  expect(response.status).toBe(200);
  expect(state.accountHistory).toHaveBeenCalledWith("usr_a", {
    days: 90,
    action: "move-items",
    productId: "prd_a",
    collectionId: "lcol_source",
    page: 2,
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  const exportResponse = await historyExport(request("/api/library/collections/history/export"));
  expect(exportResponse.headers.get("content-disposition")).toContain(
    "collection-command-history.json",
  );
  expect(exportResponse.headers.get("x-content-type-options")).toBe("nosniff");
  expect(exportResponse.headers.get("vary")).toBe("Cookie");
  state.accountHistory.mockResolvedValue({ text: "ж".repeat(270000) });
  expect((await historyExport(request("/api/library/collections/history/export"))).status).toBe(
    413,
  );
});
it("rejects anonymous, spoofed, duplicate and throttled global history reads", async () => {
  state.actor = null;
  expect((await accountHistory(request("/api/library/collections/history"))).status).toBe(401);
  expect((await historyExport(request("/api/library/collections/history/export"))).status).toBe(
    401,
  );
  state.actor = { id: "usr_a", role: "user" };
  for (const q of ["userId=other", "page=1&page=2", "productId=../private", "days=1000"])
    expect((await accountHistory(request(`/api/library/collections/history?${q}`))).status).toBe(
      400,
    );
  state.rate.mockResolvedValue({ success: false });
  expect((await accountHistory(request("/api/library/collections/history"))).status).toBe(429);
  expect(state.accountHistory).not.toHaveBeenCalled();
});

it("inspects only session-owned collection pairs with private bounded comparison selectors", async () => {
  state.comparison.mockResolvedValue({ schemaVersion: 1, comparison: null });
  const path = `${base}/lcol_a/compare`;
  const response = await comparison(
    request(`${path}?to=lcol_b&filter=source-only&page=2&q=100%25&transfer=move`),
    context,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(state.comparison).toHaveBeenCalledWith("usr_a", "lcol_a", {
    to: "lcol_b",
    filter: "source-only",
    page: 2,
    q: "100%",
    transfer: "move",
  });
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  vi.clearAllMocks();
  for (const query of [
    "userId=other",
    "to=lcol_b&to=lcol_c",
    "filter=common",
    "to=../private",
    "to=lcol_b&pageSize=100",
    "to=lcol_b&transfer=delete",
  ])
    expect((await comparison(request(`${path}?${query}`), context)).status).toBe(400);
  expect(state.comparison).not.toHaveBeenCalled();
  state.actor = null;
  expect((await comparison(request(path), context)).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await comparison(request(path), context)).status).toBe(429);
  expect(state.comparison).not.toHaveBeenCalled();
});
it("masks foreign destinations without returning their collection metadata", async () => {
  state.comparison.mockRejectedValue(new AppError("Foreign private name", 404, "NOT_FOUND"));
  const response = await comparison(request(`${base}/lcol_a/compare?to=lcol_foreign`), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});

it("applies a strict resource-bound membership batch through the session and content-creation budget", async () => {
  state.membershipBatch.mockResolvedValue({ replayed: false, receipt: { id: "lmb_a" } });
  const changes = [
    { collectionId: "lcol_b", expectedRevision: 4, wasInCollection: true, inCollection: false },
    { collectionId: "lcol_a", expectedRevision: 2, wasInCollection: false, inCollection: true },
  ];
  const path = "/api/library/prd_a/collections",
    context = { params: Promise.resolve({ id: "prd_a" }) };
  const response = await membershipBatch(post({ requestId, changes }, path), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
  expect(state.membershipBatch).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "usr_a",
      productId: "prd_a",
      command: { requestId, changes: [changes[1], changes[0]] },
      receiptId: "lmb_a",
      auditId: "aud_a",
    }),
  );
  vi.clearAllMocks();
  for (const body of [
    { requestId, changes, userId: "other" },
    { requestId, changes, productId: "prd_other" },
    { requestId, changes: [changes[0], changes[0]] },
    { requestId, changes: [{ ...changes[0], inCollection: true }] },
  ])
    expect((await membershipBatch(post(body, path), context)).status).toBe(400);
  expect(
    (await membershipBatch(post({ requestId, changes }, `${path}?to=foreign`), context)).status,
  ).toBe(400);
  expect(
    (
      await membershipBatch(
        post({ requestId, changes }, path, {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(state.membershipBatch).not.toHaveBeenCalled();
  state.actor = null;
  expect((await membershipBatch(post({ requestId, changes }, path), context)).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await membershipBatch(post({ requestId, changes }, path), context)).status).toBe(429);
  expect(state.membershipBatch).not.toHaveBeenCalled();
});

it("reads owner-scoped whole membership groups and stable details with private bounded JSON export", async () => {
  state.membershipHistory.mockResolvedValue({ schemaVersion: 1, items: [] });
  state.membershipReceipt.mockResolvedValue({ schemaVersion: 1, item: { id: "lmb_a" } });
  const path = "/api/library/collections/membership-history";
  const response = await membershipHistory(
    request(`${path}?days=90&operation=mixed&collectionId=lcol_a&productId=prd_a&page=2`),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.membershipHistory).toHaveBeenCalledWith("usr_a", {
    page: 2,
    days: 90,
    operation: "mixed",
    collectionId: "lcol_a",
    productId: "prd_a",
  });
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  const detail = await membershipReceipt(request(`${path}/lmb_a`), {
    params: Promise.resolve({ id: "lmb_a" }),
  });
  expect(detail.status).toBe(200);
  expect(state.membershipReceipt).toHaveBeenCalledWith("usr_a", "lmb_a");
  const exported = await membershipHistoryExport(request(`${path}/export`));
  expect(exported.headers.get("content-disposition")).toContain(
    "collection-membership-history.json",
  );
  expect(exported.headers.get("x-content-type-options")).toBe("nosniff");
  expect(exported.headers.get("cache-control")).toBe("private, no-store");
  state.membershipHistory.mockResolvedValue({ text: "ж".repeat(270000) });
  expect((await membershipHistoryExport(request(`${path}/export`))).status).toBe(413);
});
it("rejects anonymous, injected, duplicate and throttled membership reads before repository access", async () => {
  const path = "/api/library/collections/membership-history";
  for (const params of [
    "userId=other",
    "operation=add",
    "days=31",
    "productId=../private",
    "page=1&page=2",
  ])
    expect((await membershipHistory(request(`${path}?${params}`))).status).toBe(400);
  expect(
    (
      await membershipReceipt(request(`${path}/lmb_a?userId=other`), {
        params: Promise.resolve({ id: "lmb_a" }),
      })
    ).status,
  ).toBe(400);
  state.actor = null;
  expect((await membershipHistory(request(path))).status).toBe(401);
  expect((await membershipHistoryExport(request(`${path}/export`))).status).toBe(401);
  expect(
    (
      await membershipReceipt(request(`${path}/lmb_a`), {
        params: Promise.resolve({ id: "lmb_a" }),
      })
    ).status,
  ).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await membershipHistory(request(path))).status).toBe(429);
  expect((await membershipHistoryExport(request(`${path}/export`))).status).toBe(429);
  expect(
    (
      await membershipReceipt(request(`${path}/lmb_a`), {
        params: Promise.resolve({ id: "lmb_a" }),
      })
    ).status,
  ).toBe(429);
  expect(state.membershipHistory).not.toHaveBeenCalled();
  expect(state.membershipReceipt).not.toHaveBeenCalled();
});

it("exports own complete manifests privately and previews bounded imported references under fixed session/route identity", async () => {
  state.exportManifest.mockResolvedValue({ schemaVersion: 1, productIds: ["prd_a"] });
  state.importPreview.mockResolvedValue({ schemaVersion: 1, items: [] });
  const response = await exportManifest(request(`${base}/lcol_a/export`), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("content-disposition")).toContain("resource-collection.json");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(state.exportManifest).toHaveBeenCalledWith("usr_a", "lcol_a");
  const input = {
    schemaVersion: 1,
    collection: { id: "lcol_source", name: "Source", status: "active", revision: 4 },
    generatedAt: "2026-10-12T00:00:00.000Z",
    productIds: ["prd_a"],
  };
  expect((await importPreview(post(input, `${base}/lcol_a/import-preview`), context)).status).toBe(
    200,
  );
  expect(state.importPreview).toHaveBeenCalledWith("usr_a", "lcol_a", input);
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(state.rate).toHaveBeenCalledWith("contentCreation", "usr_a");
  state.exportManifest.mockResolvedValue({ text: "ж".repeat(33000) });
  expect((await exportManifest(request(`${base}/lcol_a/export`), context)).status).toBe(413);
});
it("rejects unauthorized, spoofed, cross-site, oversized and throttled manifest requests before repository work", async () => {
  const path = `${base}/lcol_a/import-preview`;
  expect((await exportManifest(request(`${base}/lcol_a/export?page=1`), context)).status).toBe(400);
  expect((await importPreview(post({}, `${path}?userId=other`), context)).status).toBe(400);
  expect(
    (await importPreview(post({}, path, { "content-type": "text/plain" }), context)).status,
  ).toBe(415);
  expect(
    (
      await importPreview(
        post({}, path, { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect((await importPreview(post({ text: "ж".repeat(33000) }, path), context)).status).toBe(413);
  expect(
    (
      await importPreview(
        post({}, path, { "content-type": "application/json", "content-length": "65537" }),
        context,
      )
    ).status,
  ).toBe(413);
  state.actor = null;
  expect((await exportManifest(request(`${base}/lcol_a/export`), context)).status).toBe(401);
  expect((await importPreview(post({}, path), context)).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await exportManifest(request(`${base}/lcol_a/export`), context)).status).toBe(429);
  expect((await importPreview(post({}, path), context)).status).toBe(429);
  expect(state.exportManifest).not.toHaveBeenCalled();
  expect(state.importPreview).not.toHaveBeenCalled();
});

it("previews reconciliation with fixed owner/target and rejects extra selectors or oversized/cross-site bodies", async () => {
  state.importPreview.mockResolvedValue({ schemaVersion: 1, items: [] });
  const path = `${base}/lcol_a/reconcile-preview`,
    file = {
      schemaVersion: 1,
      generatedAt: "2026-10-13T00:00:00.000Z",
      collection: { id: "lcol_source", name: "Source", status: "active", revision: 1 },
      productIds: ["prd_a"],
    };
  expect((await reconcilePreview(post(file, path), context)).status).toBe(200);
  expect(state.importPreview).toHaveBeenCalledWith("usr_a", "lcol_a", file, true);
  expect((await reconcilePreview(post(file, `${path}?userId=other`), context)).status).toBe(400);
  expect(
    (
      await reconcilePreview(
        post(file, path, { "content-type": "application/json", "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect((await reconcilePreview(post({ text: "ж".repeat(33000) }, path), context)).status).toBe(
    413,
  );
});
it("uses the existing atomic command endpoint for strict reconciliation bodies", async () => {
  const body = {
    requestId,
    action: "reconcile-items",
    expectedRevision: 4,
    addProductIds: ["prd_new"],
    removeProductIds: ["prd_old"],
  };
  expect((await command(post(body, `${base}/lcol_a`), context)).status).toBe(200);
  expect(state.command).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "usr_a", collectionId: "lcol_a", command: body }),
  );
  expect(
    (await command(post({ ...body, removeProductIds: ["prd_new"] }, `${base}/lcol_a`), context))
      .status,
  ).toBe(400);
});

it("inspects and exports owner-scoped immutable receipts privately without accepting identity selectors", async () => {
  const path = `${base}/receipts/lcr_a`,
    ctx = { params: Promise.resolve({ id: "lcr_a" }) };
  state.receiptDetail.mockResolvedValue({ schemaVersion: 1, id: "lcr_a" });
  const response = await receiptDetail(request(path), ctx);
  expect(response.status).toBe(200);
  expect(state.receiptDetail).toHaveBeenCalledWith("usr_a", "lcr_a");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  const exported = await receiptExport(request(`${path}/export`), ctx);
  expect(exported.headers.get("content-disposition")).toContain("collection-receipt.json");
  expect(exported.headers.get("x-content-type-options")).toBe("nosniff");
  expect(exported.headers.get("cache-control")).toBe("private, no-store");
  state.receiptDetail.mockResolvedValue({ text: "ж".repeat(270000) });
  expect((await receiptExport(request(`${path}/export`), ctx)).status).toBe(413);
});
it("rejects anonymous, injected and throttled receipt detail/export before database access", async () => {
  const path = `${base}/receipts/lcr_a`,
    ctx = { params: Promise.resolve({ id: "lcr_a" }) };
  for (const handler of [receiptDetail, receiptExport]) {
    expect((await handler(request(`${path}?userId=other`), ctx)).status).toBe(400);
    expect((await handler(request(`${path}?page=1`), ctx)).status).toBe(400);
  }
  state.actor = null;
  expect((await receiptDetail(request(path), ctx)).status).toBe(401);
  expect((await receiptExport(request(`${path}/export`), ctx)).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await receiptDetail(request(path), ctx)).status).toBe(429);
  expect((await receiptExport(request(`${path}/export`), ctx)).status).toBe(429);
  expect(state.receiptDetail).not.toHaveBeenCalled();
});
