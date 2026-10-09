import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: "user" | "developer" | "admin";
  },
  product: null as null | {
    id: string;
    slug: string;
    authorId: string;
    status: "published" | "draft" | "suspended" | "archived";
  },
  entitled: false,
  managementAccess: false,
  build: null as null | {
    id: string;
    productId: string;
    version: string;
    status: "published";
    scanStatus: "not_scanned" | "clean" | "malicious" | "error";
    scanner?: string;
    scannedAt?: Date;
    storageKey: string;
    sha256Hash: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  },
}));

const auditRecord = vi.hoisted(() => vi.fn(async () => undefined));
const downloadStream = vi.hoisted(() => vi.fn());
const findLatestPublishedBuild = vi.hoisted(() => vi.fn());
const findPinnedPublishedBuild = vi.hoisted(() => vi.fn());

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: {
    checkEntitlement: vi.fn(async () => state.entitled),
  },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    canManageProduct: vi.fn(async () => state.managementAccess),
  },
}));

vi.mock("@nexus/db", () => ({
  productRepository: {
    findById: vi.fn(async () => state.product),
  },
  buildRepository: {
    findLatestPublishedByProduct: findLatestPublishedBuild,
    findPublishedByProductAndId: findPinnedPublishedBuild,
  },
  auditRepository: {
    record: auditRecord,
  },
}));

vi.mock("@nexus/storage", () => ({
  storageService: {
    getDownloadStream: downloadStream,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: true,
    remaining: 1,
    resetAt: new Date(Date.now() + 60_000),
  })),
  generateId: vi.fn(() => "aud_http_download"),
}));

import { GET } from "../apps/web/src/app/api/products/[id]/download/route";

function request() {
  return new NextRequest("http://nexus.test/api/products/prd_http/download", { method: "GET" });
}

const context = {
  params: Promise.resolve({ id: "prd_http" }),
};

describe("resource download HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditRecord.mockReset();
    downloadStream.mockReset();
    state.user = {
      id: "usr_player",
      email: "player@nexus.test",
      username: "player",
      displayName: "Player",
      role: "user",
    };
    state.product = {
      id: "prd_http",
      slug: "http-resource",
      authorId: "usr_author",
      status: "published",
    };
    state.entitled = true;
    state.managementAccess = false;
    state.build = {
      id: "bld_http",
      productId: "prd_http",
      version: "1.2.3",
      status: "published",
      scanStatus: "clean",
      scanner: "test-scanner",
      scannedAt: new Date(),
      storageKey: "assets/http-resource.zip",
      sha256Hash: "a".repeat(64),
      fileName: "http-resource.zip",
      fileSizeBytes: Buffer.byteLength("nexus-build"),
      mimeType: "application/zip",
    };
    findLatestPublishedBuild.mockImplementation(
      async () => state.build,
    );
    findPinnedPublishedBuild.mockImplementation(
      async (productId: string, buildId: string) =>
        productId === state.build?.productId && buildId === state.build?.id
          ? state.build
          : null,
    );
    downloadStream.mockResolvedValue({
      stream: Readable.from(Buffer.from("nexus-build")),
      meta: {
        sizeBytes: Buffer.byteLength("nexus-build"),
        sha256Hash: state.build!.sha256Hash,
        mimeType: "application/zip",
      },
    });
  });

  it("returns 401 for an anonymous download", async () => {
    state.user = null;

    const response = await GET(request(), context);

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
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
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
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
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
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
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
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
        sha256Hash: state.build!.sha256Hash,
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
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
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
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "nexus-build",
    );
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
    expect(response.headers.get("X-Content-SHA256")).toBe("a".repeat(64));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="http-resource-1.2.3.zip"',
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe("nexus-build");
    expect(downloadStream).toHaveBeenCalledWith("assets/http-resource.zip", expect.any(AbortSignal));
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product.download_started",
        targetId: "prd_http",
      }),
    );
  });
});

describe("pinned historical build downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditRecord.mockReset();
    downloadStream.mockReset();
    state.user = {
      id: "usr_player",
      email: "player@nexus.test",
      username: "player",
      displayName: "Player",
      role: "user",
    };
    state.product = {
      id: "prd_http",
      slug: "http-resource",
      authorId: "usr_author",
      status: "published",
    };
    state.entitled = true;
    state.managementAccess = false;
    state.build = {
      id: "bld_historical_1",
      productId: "prd_http",
      version: "1.0.0",
      status: "published",
      scanStatus: "clean",
      scanner: "test-scanner",
      scannedAt: new Date(),
      storageKey: "assets/old-resource.zip",
      sha256Hash: "a".repeat(64),
      fileName: "historical-resource.zip",
      fileSizeBytes: Buffer.byteLength("historical"),
      mimeType: "application/zip",
    };
    findLatestPublishedBuild.mockResolvedValue(null);
    findPinnedPublishedBuild.mockImplementation(
      async (productId: string, buildId: string) =>
        productId === "prd_http" && buildId === "bld_historical_1"
          ? state.build
          : null,
    );
    downloadStream.mockResolvedValue({
      stream: Readable.from(Buffer.from("historical")),
      meta: { sizeBytes: Buffer.byteLength("historical"), sha256Hash: state.build!.sha256Hash, mimeType: "application/zip" },
    });
  });

  function pinned(query = "?buildId=bld_historical_1") {
    return new NextRequest(`http://nexus.test/api/products/prd_http/download${query}`);
  }

  it("serves the exact approved historical build without selecting the latest", async () => {
    const response = await GET(pinned(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Resource-Build-Id")).toBe("bld_historical_1");
    expect(response.headers.get("X-Content-SHA256")).toBe("a".repeat(64));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toContain("http-resource-1.0.0.zip");
    expect(findPinnedPublishedBuild).toHaveBeenCalledWith("prd_http", "bld_historical_1");
    expect(findLatestPublishedBuild).not.toHaveBeenCalled();
    expect(downloadStream).toHaveBeenCalledWith("assets/old-resource.zip", expect.any(AbortSignal));
    expect(await response.text()).toBe("historical");
    expect(auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: "product.download_started",
      details: expect.objectContaining({
        buildId: "bld_historical_1",
        version: "1.0.0",
        pinned: true,
      }),
    }));
  });

  it.each([
    "?buildId=bld_one&buildId=bld_two",
    "?buildId=../secret",
    "?buildId=",
    "?buildId=lic_secret",
    "?buildId=bld_bad%0Aheader",
  ])("refuses malformed pinned selectors before storage access: %s", async query => {
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
});
