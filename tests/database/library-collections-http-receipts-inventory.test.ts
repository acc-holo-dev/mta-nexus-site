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

import { GET as receiptExport } from "../../apps/web/src/app/api/library/collections/receipts/[id]/export/route";
import { GET as receiptDetail } from "../../apps/web/src/app/api/library/collections/receipts/[id]/route";
import { GET as inventoryExport } from "../../apps/web/src/app/api/library/collections/resources/export/route";
import { GET as inventory } from "../../apps/web/src/app/api/library/collections/resources/route";
import {
  libraryCollectionsHttpBase as base,
  installLibraryCollectionsHttpLifecycle,
  libraryCollectionsHttpRequest as request,
  libraryCollectionsHttpState as state,
} from "../helpers/library-collections-http-harness";

installLibraryCollectionsHttpLifecycle();

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

it("reads and exports private resource inventory under fixed session identity and bounded filters", async () => {
  const path = `${base}/resources`;
  state.inventory.mockResolvedValue({ schemaVersion: 1, items: [] });
  const response = await inventory(
    request(`${path}?page=2&status=active&filter=shared&q=%25&collectionId=lcol_a&release=pinned`),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.inventory).toHaveBeenCalledWith("usr_a", {
    page: 2,
    status: "active",
    filter: "shared",
    q: "%",
    collectionId: "lcol_a",
    release: "pinned",
  });
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  const exported = await inventoryExport(request(`${path}/export`));
  expect(exported.headers.get("content-disposition")).toContain("collection-resources.json");
  expect(exported.headers.get("x-content-type-options")).toBe("nosniff");
  expect(exported.headers.get("cache-control")).toBe("private, no-store");
  state.inventory.mockResolvedValue({ text: "ж".repeat(270000) });
  expect((await inventoryExport(request(`${path}/export`))).status).toBe(413);
});
it("rejects anonymous, spoofed, duplicated and throttled inventory reads before repository work", async () => {
  const path = `${base}/resources`;
  for (const q of [
    "userId=other",
    "page=1&page=2",
    "collectionId=../private",
    "filter=ready",
    "release=all&release=updates",
    "release=private",
  ])
    expect((await inventory(request(`${path}?${q}`))).status).toBe(400);
  state.actor = null;
  expect((await inventory(request(path))).status).toBe(401);
  expect((await inventoryExport(request(`${path}/export`))).status).toBe(401);
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: false });
  expect((await inventory(request(path))).status).toBe(429);
  expect((await inventoryExport(request(`${path}/export`))).status).toBe(429);
  expect(state.inventory).not.toHaveBeenCalled();
});
