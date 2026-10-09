import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStorageProvider } from "../packages/storage/src/local-provider";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { ValidationError } from "@nexus/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ download: vi.fn(), audit: vi.fn(), hash: "a".repeat(64) }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => ({ id: "admin", role: "admin" }) },
}));
vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: { checkEntitlement: async () => true },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { canManageProduct: async () => true },
}));
vi.mock("@nexus/security", () => ({
  can: () => true,
  consumeRateLimit: async () => ({ success: true }),
  generateId: () => "audit",
}));
vi.mock("@nexus/storage", () => ({ storageService: { getDownloadStream: mocks.download } }));
vi.mock("@nexus/db", () => {
  const build = {
    id: "build",
    productId: "product",
    version: "1.0.0",
    status: "pending_review",
    scanStatus: "clean",
    scanner: "test",
    scannedAt: new Date(),
    storageKey: "build.zip",
    fileName: "build.zip",
    fileSizeBytes: 4,
    sha256Hash: "a".repeat(64),
  };
  return {
    productRepository: {
      findById: async () => ({ id: "product", slug: "product", status: "published" }),
    },
    buildRepository: {
      findById: async () => ({ ...build, sha256Hash: mocks.hash }),
      findLatestPublishedByProduct: async () => ({
        ...build,
        status: "published",
        sha256Hash: mocks.hash,
      }),
    },
    auditRepository: { record: mocks.audit },
  };
});
import { GET as publicDownload } from "../apps/web/src/app/api/products/[id]/download/route";
import { GET as reviewDownload } from "../apps/web/src/app/api/admin/builds/[buildId]/download/route";

describe.each([false, true])("download metadata (reviewer=%s)", (reviewer) => {
  const request = (signal?: AbortSignal) => {
    const req = new NextRequest("http://nexus.test/download", { signal });
    return reviewer
      ? reviewDownload(req, { params: Promise.resolve({ buildId: "build" }) })
      : publicDownload(req, { params: Promise.resolve({ id: "product" }) });
  };
  beforeEach(() => {
    mocks.hash = "a".repeat(64);
    mocks.download.mockReset();
    mocks.audit.mockReset();
  });
  it.each([0, 3, 5])("rejects size %s before auditing or delivering bytes", async (sizeBytes) => {
    const stream = Readable.from(Buffer.from("data"));
    mocks.download.mockResolvedValue({ stream, meta: { sizeBytes, sha256Hash: mocks.hash } });
    const response = await request();
    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(await response.json()).toMatchObject({ code: "BUILD_ARTIFACT_MISMATCH" });
    expect(stream.destroyed).toBe(true);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("rejects a conflicting provider hash even when the size matches", async () => {
    const stream = Readable.from(Buffer.from("data"));
    mocks.download.mockResolvedValue({
      stream,
      meta: { sizeBytes: 4, sha256Hash: "b".repeat(64) },
    });
    expect((await request()).status).toBe(409);
    expect(stream.destroyed).toBe(true);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each([
    ["missing metadata", undefined],
    ["missing hash", { sizeBytes: 4 }],
    ["missing size", { sha256Hash: "a".repeat(64) }],
    ["invalid hash", { sizeBytes: 4, sha256Hash: "not-a-checksum" }],
    ["missing hash with correct size", { sizeBytes: 4, sha256Hash: undefined }],
  ])("rejects %s before auditing or streaming", async (_description, meta) => {
    const stream = Readable.from(Buffer.from("data"));
    mocks.download.mockResolvedValue({ stream, meta });
    const response = await request();
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "BUILD_ARTIFACT_MISMATCH" });
    expect(stream.destroyed).toBe(true);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects invalid recorded checksum even if provider repeats it", async () => {
    mocks.hash = "not-a-hash";
    const stream = Readable.from(Buffer.from("data"));
    mocks.download.mockResolvedValue({
      stream,
      meta: { sizeBytes: 4, sha256Hash: mocks.hash },
    });
    const response = await request();
    expect(response.status).toBe(409);
    expect(stream.destroyed).toBe(true);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("reports missing storage bytes as 404", async () => {
    mocks.download.mockRejectedValue(new ValidationError("missing"));
    expect((await request()).status).toBe(404);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("delivers matching bytes with the recorded content length", async () => {
    mocks.download.mockResolvedValue({
      stream: Readable.from(Buffer.from("data")),
      meta: { sizeBytes: 4, sha256Hash: mocks.hash },
    });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Length")).toBe("4");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(await response.text()).toBe("data");
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it.each([false, true])(
    "checks actual local bytes before delivery (corrupted=%s)",
    async (corrupted) => {
      const root = await mkdtemp(join(tmpdir(), "nexus-http-integrity-"));
      try {
        const provider = new LocalStorageProvider(root);
        const meta = await provider.put("build.zip", Buffer.from("data"), "application/zip");
        mocks.hash = meta.sha256Hash;
        if (corrupted) await writeFile(join(root, "build.zip"), "oops");
        mocks.download.mockImplementation((key: string) => provider.get(key));
        const response = await request();
        if (corrupted) {
          expect(response.status).toBe(409);
          expect(await response.json()).toMatchObject({ code: "BUILD_ARTIFACT_MISMATCH" });
          expect(mocks.audit).not.toHaveBeenCalled();
        } else {
          expect(response.status).toBe(200);
          expect(await response.text()).toBe("data");
          expect(response.headers.get("X-Content-SHA256")).toBe(meta.sha256Hash);
          expect(mocks.audit).toHaveBeenCalledOnce();
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );
  it("does not audit when cancellation arrives during storage preparation", async () => {
    const controller = new AbortController();
    const stream = Readable.from(Buffer.from("data"));
    mocks.download.mockImplementation(async (_key: string, signal: AbortSignal) => {
      expect(signal.aborted).toBe(false);
      controller.abort();
      return { stream, meta: { sizeBytes: 4, sha256Hash: mocks.hash } };
    });
    const response = await request(controller.signal);
    expect(response.status).toBe(499);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(await response.json()).toMatchObject({ code: "DOWNLOAD_CANCELLED" });
    expect(stream.destroyed).toBe(true);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("closes a prepared stream if cancellation arrives during audit", async () => {
    const controller = new AbortController();
    const stream = Readable.from(Buffer.from("data"));
    mocks.download.mockResolvedValue({ stream, meta: { sizeBytes: 4, sha256Hash: mocks.hash } });
    mocks.audit.mockImplementation(async () => { controller.abort(); });
    const response = await request(controller.signal);
    expect(response.status).toBe(499);
    expect(stream.destroyed).toBe(true);
    expect(mocks.audit).toHaveBeenCalledOnce();
  });

});
