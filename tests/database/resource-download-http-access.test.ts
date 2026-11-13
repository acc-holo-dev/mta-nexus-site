import { expect, it, vi } from "vitest";

vi.mock("../../site/src/lib/services/auth-service", async () => {
  const { resourceDownloadHttpState } = await import("../helpers/resource-download-http-harness");
  return {
    authService: {
      getSession: vi.fn(async () => resourceDownloadHttpState.user),
    },
  };
});

vi.mock("../../site/src/lib/services/commerce-service", async () => {
  const { resourceDownloadHttpState } = await import("../helpers/resource-download-http-harness");
  return {
    commerceService: {
      checkEntitlement: vi.fn(async () => resourceDownloadHttpState.entitled),
    },
  };
});

vi.mock("../../site/src/lib/services/product-service", async () => {
  const { resourceDownloadHttpState } = await import("../helpers/resource-download-http-harness");
  return {
    productService: {
      canManageProduct: vi.fn(async () => resourceDownloadHttpState.managementAccess),
    },
  };
});

vi.mock("@nexus/db", async () => {
  const { createResourceDownloadHttpDbMock } = await import(
    "../helpers/resource-download-http-harness"
  );
  return createResourceDownloadHttpDbMock();
});

vi.mock("@nexus/storage", async () => {
  const { resourceDownloadHttpDownloadStream } = await import(
    "../helpers/resource-download-http-harness"
  );
  return {
    storageService: {
      getDownloadStream: resourceDownloadHttpDownloadStream,
    },
  };
});

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: true,
    remaining: 1,
    resetAt: new Date(Date.now() + 60_000),
  })),
  generateId: vi.fn(() => "aud_http_download"),
}));

import { GET } from "../../site/src/app/api/products/[id]/download/route";
import {
  resourceDownloadHttpContext as context,
  resourceDownloadHttpDownloadStream as downloadStream,
  installResourceDownloadHttpLatestLifecycle,
  resourceDownloadHttpRequest as request,
  resourceDownloadHttpState as state,
} from "../helpers/resource-download-http-harness";

installResourceDownloadHttpLatestLifecycle();

it("returns 401 for an anonymous download", async () => {
  state.user = null;

  const response = await GET(request(), context);

  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
  expect(await response.json()).toEqual({
    error: "Authentication required to download resource builds",
  });
  expect(downloadStream).not.toHaveBeenCalled();
});

it("returns 404 for an unpublished resource even with entitlement", async () => {
  if (!state.product) throw new Error("Expected default product fixture");
  state.product = {
    ...state.product,
    status: "draft",
  };

  const response = await GET(request(), context);

  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
  expect(await response.json()).toEqual({
    error: "Resource not found",
  });
  expect(downloadStream).not.toHaveBeenCalled();
});

it("returns 403 for a published resource without entitlement", async () => {
  state.entitled = false;

  const response = await GET(request(), context);

  expect(response.status).toBe(403);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
  expect(await response.json()).toEqual({
    error: "Add this resource to your library before downloading it",
  });
  expect(downloadStream).not.toHaveBeenCalled();
});

it("does not treat stale author attribution as management access", async () => {
  state.user = {
    id: "usr_author",
    email: "former-manager@nexus.test",
    username: "former-manager",
    displayName: "Former Manager",
    role: "developer",
  };
  if (!state.product) throw new Error("Expected default product fixture");
  state.product = {
    ...state.product,
    authorId: "usr_author",
  };
  state.managementAccess = false;
  state.entitled = false;

  const response = await GET(request(), context);

  expect(response.status).toBe(403);
  expect(downloadStream).not.toHaveBeenCalled();
});

it("allows a current resource manager without requiring a library entitlement", async () => {
  state.managementAccess = true;
  state.entitled = false;

  const response = await GET(request(), context);

  expect(response.status).toBe(200);
  expect(downloadStream).toHaveBeenCalledTimes(1);
});
