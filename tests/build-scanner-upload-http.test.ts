import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const scan = vi.hoisted(() => vi.fn());
const uploadAsset = vi.hoisted(() => vi.fn());
const deleteAsset = vi.hoisted(() => vi.fn());
const preflight = vi.hoisted(() => vi.fn());
const releaseBuild = vi.hoisted(() => vi.fn());

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_scanner_author",
      email: "scanner-author@nexus.test",
      username: "scanner-author",
      displayName: "Scanner Author",
      role: "developer",
    })),
  },
}));

vi.mock("../apps/web/src/lib/services/build-scanner-service", () => ({
  buildScannerService: { scan },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    assertCanReleaseBuild: preflight,
    releaseBuild,
  },
}));

vi.mock("@nexus/storage", () => ({
  MAX_FILE_SIZE_BYTES: 64 * 1024 * 1024,
  storageService: {
    uploadAsset,
    deleteAsset,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: true,
    remaining: 9,
    resetAt: Date.now() + 60_000,
  })),
}));

import { POST } from "../apps/web/src/app/api/products/[id]/builds/route";

function uploadRequest(mtaVersionTarget?: string) {
  const form = new FormData();
  form.set(
    "file",
    new File(
      [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4])],
      "resource.zip",
      { type: "application/zip" },
    ),
  );
  form.set("version", "1.0.0");
  if (mtaVersionTarget) form.set("mtaVersionTarget", mtaVersionTarget);

  return new NextRequest(
    "http://nexus.test/api/products/prd_scanner/builds",
    {
      method: "POST",
      headers: { cookie: "nexus_session=tok_scanner" },
      body: form,
    },
  );
}

const context = {
  params: Promise.resolve({ id: "prd_scanner" }),
};

describe("build upload scanner HTTP behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preflight.mockResolvedValue({
      id: "prd_scanner",
      price: 0,
    });
    uploadAsset.mockResolvedValue({
      id: "ast_scanner",
      key: "assets/usr_scanner_author/ast_scanner_resource.zip",
      sizeBytes: 8,
      mimeType: "application/zip",
      sha256Hash: "a".repeat(64),
      isPrivate: true,
      uploadedAt: new Date(),
    });
    releaseBuild.mockResolvedValue({
      id: "bld_scanner",
      productId: "prd_scanner",
      version: "1.0.0",
      status: "pending_review",
    });
  });

  it("rejects malicious verdicts before storage or release persistence", async () => {
    scan.mockResolvedValueOnce({
      status: "malicious",
      scanner: "clamav",
      scannedAt: new Date(),
      reason: "Eicar-Test-Signature FOUND",
    });

    const response = await POST(uploadRequest(), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "Build was rejected by the malware scanner",
      code: "BUILD_MALWARE_DETECTED",
      scanner: "clamav",
    });
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it("fails closed on scanner infrastructure errors before storage", async () => {
    scan.mockResolvedValueOnce({
      status: "error",
      scanner: "clamav",
      scannedAt: new Date(),
      reason: "Scanner timeout",
    });

    const response = await POST(uploadRequest(), context);

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    expect(await response.json()).toEqual({
      error:
        "Malware scanning is temporarily unavailable. No build was stored; retry the upload later.",
      code: "BUILD_SCANNER_UNAVAILABLE",
    });
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it("rejects archives that ClamAV could not fully inspect because of scan limits", async () => {
    scan.mockResolvedValueOnce({
      status: "rejected",
      scanner: "clamav",
      scannedAt: new Date(),
      reason: "Heuristics.Limits.Exceeded.MaxRecursion FOUND",
    });

    const response = await POST(uploadRequest(), context);

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("could not be fully checked"),
      code: "BUILD_SCAN_LIMIT_EXCEEDED",
      scanner: "clamav",
    });
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
  });

  it("stores and submits only after a clean verdict", async () => {
    const scannedAt = new Date();
    scan.mockResolvedValueOnce({
      status: "clean",
      scanner: "clamav",
      scannedAt,
    });

    const response = await POST(uploadRequest(), context);

    expect(response.status).toBe(201);
    expect(preflight).toHaveBeenCalledTimes(1);
    expect(scan).toHaveBeenCalledTimes(1);
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(releaseBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prd_scanner",
        version: "1.0.0",
        sha256Hash: "a".repeat(64),
        scanStatus: "clean",
        scanner: "clamav",
        scannedAt,
      }),
      expect.objectContaining({ id: "usr_scanner_author" }),
    );
  });

  it("stores the exact sortable MTA target on a clean uploaded build", async () => {
    const sortableTarget = "1.6.0-9.22279.0";
    scan.mockResolvedValueOnce({
      status: "clean",
      scanner: "clamav",
      scannedAt: new Date(),
    });

    const response = await POST(uploadRequest(sortableTarget), context);

    expect(response.status).toBe(201);
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(releaseBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        mtaVersionTarget: sortableTarget,
        scanStatus: "clean",
      }),
      expect.objectContaining({ id: "usr_scanner_author" }),
    );
  });
});
