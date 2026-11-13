import { AppError } from "@nexus/domain";
import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createLibraryCollectionsHttpDbMock } = await import(
    "../helpers/library-collections-http-harness"
  );
  return createLibraryCollectionsHttpDbMock();
});
vi.mock("@nexus/security", async () => {
  const { libraryCollectionsHttpState } = await import(
    "../helpers/library-collections-http-harness"
  );
  return {
    consumeRateLimit: libraryCollectionsHttpState.rate,
    generateId: (prefix: string) => `${prefix}_a`,
  };
});
vi.mock("../../site/src/lib/services/auth-service", async () => {
  const { libraryCollectionsHttpState } = await import(
    "../helpers/library-collections-http-harness"
  );
  return {
    authService: { getSession: async () => libraryCollectionsHttpState.actor },
  };
});

import {
  POST as membershipBatch,
  GET as resourceMemberships,
} from "../../site/src/app/api/library/[id]/collections/route";
import { GET as membershipReceipt } from "../../site/src/app/api/library/collections/membership-history/[id]/route";
import { GET as membershipHistoryExport } from "../../site/src/app/api/library/collections/membership-history/export/route";
import { GET as membershipHistory } from "../../site/src/app/api/library/collections/membership-history/route";
import {
  installLibraryCollectionsHttpLifecycle,
  libraryCollectionsHttpPost as post,
  libraryCollectionsHttpRequest as request,
  libraryCollectionsHttpRequestId as requestId,
  libraryCollectionsHttpState as state,
} from "../helpers/library-collections-http-harness";

installLibraryCollectionsHttpLifecycle();

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
      currentToken: "raw-browser-token",
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
