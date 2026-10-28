import { createHash } from "node:crypto";
import packageFixtures from "./fixtures/build-packages.json";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError, ForbiddenError } from "@nexus/domain";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  release: vi.fn(),
  recover: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  scan: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({ id: "usr_author", role: "developer" })),
  },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    assertCanReleaseBuild: mocks.authorize,
    releaseBuild: mocks.release,
    recoverPendingBuildUpload: mocks.recover,
  },
}));
vi.mock("../apps/web/src/lib/services/build-scanner-service", () => ({
  buildScannerService: { scan: mocks.scan },
}));
vi.mock("@nexus/storage", () => ({
  MAX_FILE_SIZE_BYTES: 1024,
  storageService: { uploadAsset: mocks.upload, deleteAsset: mocks.remove },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: vi.fn(async () => ({ success: true })) }));
import { POST } from "../apps/web/src/app/api/products/[id]/builds/route";

function request() {
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array(Buffer.from(packageFixtures.stored, "base64"))], "resource.zip"),
  );
  form.set("version", "v1.2.3");
  form.set("releaseNotes", " Retry notes ");
  form.set("mtaVersionTarget", "1.6.0");
  return new NextRequest("http://nexus.test/api/products/prd_target/builds", {
    method: "POST",
    headers: browserMutationHeaders(),
    body: form,
  });
}
const context = { params: Promise.resolve({ id: "prd_target" }) };
const existing = {
  id: "bld_original",
  productId: "prd_target",
  version: "1.2.3",
  status: "pending_review",
  storageKey: "secret/old.zip",
};

describe("exact build upload retry HTTP", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    stubBrowserMutationOrigin();
    mocks.authorize.mockResolvedValue({ id: "prd_target", price: 0 });
    mocks.scan.mockResolvedValue({ status: "clean", scanner: "clamav", scannedAt: new Date() });
    mocks.upload.mockResolvedValue({
      key: "new/retry.zip",
      sha256Hash: createHash("sha256")
        .update(Buffer.from(packageFixtures.stored, "base64"))
        .digest("hex"),
      sizeBytes: Buffer.from(packageFixtures.stored, "base64").length,
    });
    mocks.release.mockRejectedValue(
      new AppError("This resource version already exists", 409, "BUILD_VERSION_EXISTS"),
    );
    mocks.recover.mockResolvedValue(existing);
  });

  it("cleans the redundant upload before confirming the original identity without storage details", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reusedBuild: true,
      build: {
        id: "bld_original",
        productId: "prd_target",
        version: "1.2.3",
        status: "pending_review",
      },
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.remove).toHaveBeenCalledWith("new/retry.zip");
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.recover.mock.invocationCallOrder[0],
    );
    expect(mocks.recover).toHaveBeenCalledWith(
      {
        productId: "prd_target",
        version: "1.2.3",
        releaseNotes: " Retry notes ",
        mtaVersionTarget: "1.6.0",
        sha256Hash: createHash("sha256")
          .update(Buffer.from(packageFixtures.stored, "base64"))
          .digest("hex"),
        fileSizeBytes: Buffer.from(packageFixtures.stored, "base64").length,
        fileName: "resource.zip",
        mimeType: "application/zip",
      },
      { id: "usr_author", role: "developer" },
    );
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("preserves a version conflict when immutable upload details or pending scan state do not match", async () => {
    mocks.recover.mockResolvedValue(null);
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "BUILD_VERSION_EXISTS" });
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("does not recover when permissions have been revoked during upload", async () => {
    mocks.recover.mockRejectedValue(new ForbiddenError("Not authorized"));
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("leaves normal creation at 201 and never removes its asset", async () => {
    mocks.release.mockResolvedValue(existing);
    const response = await POST(request(), context);
    expect(response.status).toBe(201);
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not attempt recovery for unrelated persistence errors", async () => {
    mocks.release.mockRejectedValue(new AppError("Storage failure", 503, "STORAGE_FAILURE"));
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    expect(mocks.recover).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("cannot claim retry success until redundant storage cleanup succeeds", async () => {
    mocks.remove.mockRejectedValue(new AppError("Cleanup unavailable", 503, "STORAGE_FAILURE"));
    const response = await POST(request(), context);
    expect(response.status).toBe(503);
    expect(mocks.recover).not.toHaveBeenCalled();
  });
});
