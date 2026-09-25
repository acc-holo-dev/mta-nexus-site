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
  build: null as null | {
    id: string;
    productId: string;
    version: string;
    status: "published";
    storageKey: string;
    sha256Hash: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  },
}));

const auditRecord = vi.hoisted(() => vi.fn(async () => undefined));
const downloadStream = vi.hoisted(() => vi.fn());

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

vi.mock("@nexus/db", () => ({
  productRepository: {
    findById: vi.fn(async () => state.product),
  },
  buildRepository: {
    findLatestPublishedByProduct: vi.fn(async () => state.build),
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
  return new NextRequest(
    "http://nexus.test/api/products/prd_http/download",
    { method: "GET" },
  );
}

const context = {
  params: Promise.resolve({ id: "prd_http" }),
};

describe("resource download HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    state.build = {
      id: "bld_http",
      productId: "prd_http",
      version: "1.2.3",
      status: "published",
      storageKey: "assets/http-resource.zip",
      sha256Hash: "a".repeat(64),
      fileName: "http-resource.zip",
      fileSizeBytes: Buffer.byteLength("nexus-build"),
      mimeType: "application/zip",
    };
    downloadStream.mockResolvedValue({
      stream: Readable.from(Buffer.from("nexus-build")),
      meta: {
        sizeBytes: Buffer.byteLength("nexus-build"),
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
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await response.json()).toEqual({
      error: "Authentication required to download resource builds",
    });
    expect(downloadStream).not.toHaveBeenCalled();
  });

  it("returns 404 for an unpublished resource even with entitlement", async () => {
    state.product = {
      ...state.product!,
      status: "draft",
    };

    const response = await GET(request(), context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Resource not found",
    });
    expect(downloadStream).not.toHaveBeenCalled();
  });

  it("returns 403 for a published resource without entitlement", async () => {
    state.entitled = false;

    const response = await GET(request(), context);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Add this resource to your library before downloading it",
    });
    expect(downloadStream).not.toHaveBeenCalled();
  });

  it("returns 404 when access exists but no published build is available", async () => {
    state.build = null;

    const response = await GET(request(), context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No published build is available",
    });
    expect(downloadStream).not.toHaveBeenCalled();
  });

  it("destroys an opened storage stream when the required audit write fails", async () => {
    const openedStream = Readable.from(Buffer.from("audit-failure"));
    downloadStream.mockResolvedValueOnce({
      stream: openedStream,
      meta: {
        sizeBytes: Buffer.byteLength("audit-failure"),
        mimeType: "application/zip",
      },
    });
    auditRecord.mockRejectedValueOnce(new Error("audit unavailable"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const response = await GET(request(), context);

      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Vary")).toBe("Cookie");
      expect(openedStream.destroyed).toBe(true);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("streams the published build with integrity and private-cache headers", async () => {
    const response = await GET(request(), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-SHA256")).toBe("a".repeat(64));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toContain(
      'filename="http-resource-1.2.3.zip"',
    );
    expect(Buffer.from(await response.arrayBuffer()).toString("utf8")).toBe(
      "nexus-build",
    );
    expect(downloadStream).toHaveBeenCalledWith(
      "assets/http-resource.zip",
    );
    expect(auditRecord).toHaveBeenCalledTimes(1);
  });
});
