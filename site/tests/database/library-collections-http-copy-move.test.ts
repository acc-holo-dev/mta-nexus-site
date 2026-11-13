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

import { GET as copyPreview } from "../../src/app/api/library/collections/[id]/copy/route";
import { GET as copyItemsPage } from "../../src/app/api/library/collections/[id]/copy-items/route";
import { GET as moveItemsPage } from "../../src/app/api/library/collections/[id]/move-items/route";
import { POST as command } from "../../src/app/api/library/collections/[id]/route";
import { POST as create } from "../../src/app/api/library/collections/route";
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
