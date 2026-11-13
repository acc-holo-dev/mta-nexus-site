import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("../site/src/lib/services/auth-service", async () => {
  const { resourceDownloadHttpState } = await import("./helpers/resource-download-http-harness");
  return {
    authService: {
      getSession: vi.fn(async () => resourceDownloadHttpState.user),
    },
  };
});

vi.mock("../site/src/lib/services/commerce-service", async () => {
  const { resourceDownloadHttpState } = await import("./helpers/resource-download-http-harness");
  return {
    commerceService: {
      checkEntitlement: vi.fn(async () => resourceDownloadHttpState.entitled),
    },
  };
});

vi.mock("../site/src/lib/services/product-service", async () => {
  const { resourceDownloadHttpState } = await import("./helpers/resource-download-http-harness");
  return {
    productService: {
      canManageProduct: vi.fn(async () => resourceDownloadHttpState.managementAccess),
    },
  };
});

vi.mock("@nexus/db", async () => {
  const { createResourceDownloadHttpDbMock } = await import(
    "./helpers/resource-download-http-harness"
  );
  return createResourceDownloadHttpDbMock();
});

vi.mock("@nexus/storage", async () => {
  const { resourceDownloadHttpDownloadStream } = await import(
    "./helpers/resource-download-http-harness"
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

import { GET } from "../site/src/app/api/products/[id]/download/route";
import {
  resourceDownloadHttpAuditRecord as auditRecord,
  resourceDownloadHttpContext as context,
  resourceDownloadHttpDownloadStream as downloadStream,
  resourceDownloadHttpFindLatestPublishedBuild as findLatestPublishedBuild,
  resourceDownloadHttpFindPinnedPublishedBuild as findPinnedPublishedBuild,
  installResourceDownloadHttpPinnedLifecycle,
  resourceDownloadHttpPinnedRequest as pinned,
  resourceDownloadHttpState as state,
} from "./helpers/resource-download-http-harness";

installResourceDownloadHttpPinnedLifecycle();

it("serves the exact approved historical build without selecting the latest", async () => {
  const response = await GET(pinned(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("X-Resource-Build-Id")).toBe("bld_historical_1");
  expect(response.headers.get("X-Content-SHA256")).toBe(
    createHash("sha256").update("historical").digest("hex"),
  );
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Content-Disposition")).toContain("http-resource-1.0.0.zip");
  expect(findPinnedPublishedBuild).toHaveBeenCalledWith("prd_http", "bld_historical_1");
  expect(findLatestPublishedBuild).not.toHaveBeenCalled();
  expect(downloadStream).toHaveBeenCalledWith("assets/old-resource.zip", expect.any(AbortSignal));
  expect(await response.text()).toBe("historical");
  expect(auditRecord).toHaveBeenCalledWith(
    expect.objectContaining({
      currentToken: "tok_player",
      expected: expect.objectContaining({
        id: "bld_historical_1",
        version: "1.0.0",
      }),
      pinned: true,
    }),
  );
});

it.each([
  "?buildId=bld_one&buildId=bld_two",
  "?buildId=../secret",
  "?buildId=",
  "?buildId=lic_secret",
  "?buildId=bld_bad%0Aheader",
])("refuses malformed pinned selectors before storage access: %s", async (query) => {
  const response = await GET(pinned(query), context);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "BUILD_ID_INVALID" });
  expect(downloadStream).not.toHaveBeenCalled();
  expect(findPinnedPublishedBuild).not.toHaveBeenCalled();
});

it("cannot select another product or a retired/quarantined build", async () => {
  findPinnedPublishedBuild.mockResolvedValue(null);
  const response = await GET(pinned(), context);
  expect(response.status).toBe(404);
  expect(downloadStream).not.toHaveBeenCalled();
  expect(auditRecord).not.toHaveBeenCalled();
});

it("checks current authorization before resolving a historical build", async () => {
  state.entitled = false;
  const denied = await GET(pinned(), context);
  expect(denied.status).toBe(403);
  expect(findPinnedPublishedBuild).not.toHaveBeenCalled();
  expect(downloadStream).not.toHaveBeenCalled();
});

it("enforces trusted scan provenance on a pinned build", async () => {
  if (!state.build) throw new Error("Missing pinned build");
  state.build.scanStatus = "error";
  const response = await GET(pinned(), context);
  expect(response.status).toBe(409);
  expect(downloadStream).not.toHaveBeenCalled();
});
