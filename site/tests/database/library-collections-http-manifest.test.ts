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
vi.mock("../../src/lib/services/auth-service", async () => {
  const { libraryCollectionsHttpState } = await import(
    "../helpers/library-collections-http-harness"
  );
  return {
    authService: { getSession: async () => libraryCollectionsHttpState.actor },
  };
});

import { GET as exportManifest } from "../../src/app/api/library/collections/[id]/export/route";
import { POST as importPreview } from "../../src/app/api/library/collections/[id]/import-preview/route";
import { POST as reconcilePreview } from "../../src/app/api/library/collections/[id]/reconcile-preview/route";
import { POST as command } from "../../src/app/api/library/collections/[id]/route";
import {
  libraryCollectionsHttpBase as base,
  libraryCollectionsHttpContext as context,
  installLibraryCollectionsHttpLifecycle,
  libraryCollectionsHttpPost as post,
  libraryCollectionsHttpRequest as request,
  libraryCollectionsHttpRequestId as requestId,
  libraryCollectionsHttpState as state,
} from "../helpers/library-collections-http-harness";

installLibraryCollectionsHttpLifecycle();

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
