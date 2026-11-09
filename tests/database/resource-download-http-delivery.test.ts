import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/lib/services/auth-service", async () => {
  const { resourceDownloadHttpState } = await import("../helpers/resource-download-http-harness");
  return {
    authService: {
      getSession: vi.fn(async () => resourceDownloadHttpState.user),
    },
  };
});

vi.mock("../../apps/web/src/lib/services/commerce-service", async () => {
  const { resourceDownloadHttpState } = await import("../helpers/resource-download-http-harness");
  return {
    commerceService: {
      checkEntitlement: vi.fn(async () => resourceDownloadHttpState.entitled),
    },
  };
});

vi.mock("../../apps/web/src/lib/services/product-service", async () => {
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

import { GET } from "../../apps/web/src/app/api/products/[id]/download/route";
import {
  resourceDownloadHttpAuditRecord as auditRecord,
  resourceDownloadHttpContext as context,
  resourceDownloadHttpDeliveryFinish as deliveryFinish,
  resourceDownloadHttpDownloadStream as downloadStream,
  resourceDownloadHttpFindLatestPublishedBuild as findLatestPublishedBuild,
  installResourceDownloadHttpLatestLifecycle,
  resourceDownloadHttpRequest as request,
  resourceDownloadHttpState as state,
} from "../helpers/resource-download-http-harness";

installResourceDownloadHttpLatestLifecycle();

it("records cancellation if the signal aborts after durable authorization but before headers", async () => {
  const abort = new AbortController();
  auditRecord.mockImplementationOnce(async () => {
    abort.abort();
  });
  const response = await GET(
    new NextRequest("http://nexus.test/api/products/prd_http/download", {
      signal: abort.signal,
      headers: { cookie: "nexus_session=tok_player" },
    }),
    context,
  );
  expect(response.status).toBe(499);
  expect(deliveryFinish).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "usr_player",
      receiptId: "dlv_http",
      result: { status: "cancelled", bytesSent: 0, errorCode: null },
    }),
  );
});

it("records cancellation of an unread response without claiming a full transfer", async () => {
  const response = await GET(request(), context);
  expect(response.headers.get("X-Resource-Delivery-Id")).toBe("dlv_http");
  await response.body?.cancel();
  expect(deliveryFinish).toHaveBeenCalledWith(
    expect.objectContaining({ result: { status: "cancelled", bytesSent: 0, errorCode: null } }),
  );
});

it("resolves delivery through the repository's deterministic latest-published selector", async () => {
  const response = await GET(request(), context);

  expect(response.status).toBe(200);
  expect(findLatestPublishedBuild).toHaveBeenCalledOnce();
  expect(findLatestPublishedBuild).toHaveBeenCalledWith("prd_http");
  await response.arrayBuffer();
});

it("returns 404 when access exists but no published build is available", async () => {
  state.build = null;

  const response = await GET(request(), context);

  expect(response.status).toBe(404);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
  expect(await response.json()).toEqual({
    error: "No published build is available",
  });
  expect(downloadStream).not.toHaveBeenCalled();
});

it("fails closed when a published build has no trusted scan provenance", async () => {
  if (!state.build) throw new Error("Expected default published build fixture");
  state.build = {
    ...state.build,
    scanner: undefined,
    scannedAt: undefined,
  };

  const response = await GET(request(), context);

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({
    error: "Published build is not cleared for delivery",
  });
  expect(downloadStream).not.toHaveBeenCalled();
  expect(auditRecord).not.toHaveBeenCalled();
});

it("destroys an opened storage stream when the required audit write fails", async () => {
  const openedStream = Readable.from(Buffer.from("nexus-build"));
  downloadStream.mockResolvedValueOnce({
    stream: openedStream,
    meta: {
      sizeBytes: Buffer.byteLength("nexus-build"),
      sha256Hash: state.build?.sha256Hash,
      mimeType: "application/zip",
    },
  });
  auditRecord.mockRejectedValueOnce(new Error("audit unavailable"));
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

  try {
    const response = await GET(request(), context);

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    expect(openedStream.destroyed).toBe(true);
  } finally {
    consoleError.mockRestore();
  }
});

it("falls back to a safe zip extension for an untrusted build filename", async () => {
  if (!state.build) throw new Error("Expected default published build fixture");
  state.build = {
    ...state.build,
    fileName: "resource.payload.exe",
  };

  const response = await GET(request(), context);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toContain(
    'filename="http-resource-1.2.3.zip"',
  );
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("nexus-build");
});

it("preserves an allowlisted build extension", async () => {
  if (!state.build) throw new Error("Expected default published build fixture");
  state.build = {
    ...state.build,
    fileName: "resource.lua",
    mimeType: "text/plain",
  };

  const response = await GET(request(), context);

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toContain(
    'filename="http-resource-1.2.3.lua"',
  );
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  await response.arrayBuffer();
});

it("streams the published build with integrity and private-cache headers", async () => {
  const response = await GET(request(), context);

  expect(response.status).toBe(200);
  expect(response.headers.get("X-Content-SHA256")).toBe(
    createHash("sha256").update("nexus-build").digest("hex"),
  );
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
  expect(response.headers.get("Content-Disposition")).toContain(
    'filename="http-resource-1.2.3.zip"',
  );
  expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("nexus-build");
  expect(deliveryFinish).toHaveBeenCalledWith(
    expect.objectContaining({ result: { status: "served", bytesSent: 11, errorCode: null } }),
  );
  expect(downloadStream).toHaveBeenCalledWith("assets/http-resource.zip", expect.any(AbortSignal));
  expect(auditRecord).toHaveBeenCalledTimes(1);
  expect(auditRecord).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_player",
      currentToken: "tok_player",
      expected: expect.objectContaining({ productId: "prd_http", id: "bld_http" }),
      pinned: false,
    }),
  );
});
