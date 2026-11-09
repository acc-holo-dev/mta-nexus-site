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
vi.mock("../../apps/web/src/lib/services/auth-service", async () => {
  const { libraryCollectionsHttpState } = await import(
    "../helpers/library-collections-http-harness"
  );
  return {
    authService: { getSession: async () => libraryCollectionsHttpState.actor },
  };
});

import { GET as comparison } from "../../apps/web/src/app/api/library/collections/[id]/compare/route";
import { GET as historyExport } from "../../apps/web/src/app/api/library/collections/history/export/route";
import { GET as accountHistory } from "../../apps/web/src/app/api/library/collections/history/route";
import {
  libraryCollectionsHttpBase as base,
  libraryCollectionsHttpContext as context,
  installLibraryCollectionsHttpLifecycle,
  libraryCollectionsHttpRequest as request,
  libraryCollectionsHttpState as state,
} from "../helpers/library-collections-http-harness";

installLibraryCollectionsHttpLifecycle();

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
