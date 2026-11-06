import { describe, expect, it, vi } from "vitest";

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { createBuildUploadPreflightHttpAuthMock } = await import(
    "./helpers/build-upload-preflight-http-harness"
  );
  return createBuildUploadPreflightHttpAuthMock();
});
vi.mock("../apps/web/src/lib/services/product-service", async () => {
  const { createBuildUploadPreflightHttpProductMock } = await import(
    "./helpers/build-upload-preflight-http-harness"
  );
  return createBuildUploadPreflightHttpProductMock();
});
vi.mock("../apps/web/src/lib/services/build-scanner-service", async () => {
  const { createBuildUploadPreflightHttpScannerMock } = await import(
    "./helpers/build-upload-preflight-http-harness"
  );
  return createBuildUploadPreflightHttpScannerMock();
});
vi.mock("@nexus/storage", async () => {
  const { createBuildUploadPreflightHttpStorageMock } = await import(
    "./helpers/build-upload-preflight-http-harness"
  );
  return createBuildUploadPreflightHttpStorageMock();
});
vi.mock("@nexus/security", async () => {
  const { createBuildUploadPreflightHttpSecurityMock } = await import(
    "./helpers/build-upload-preflight-http-harness"
  );
  return createBuildUploadPreflightHttpSecurityMock();
});

import { POST } from "../apps/web/src/app/api/products/[id]/builds/route";
import {
  buildUploadPreflightHttpContext as context,
  buildUploadPreflightHttpMocks as mocks,
  buildUploadPreflightHttpOversizedChunkedRequest as oversizedChunkedRequest,
  buildUploadPreflightHttpOversizedDeclaredRequest as oversizedDeclaredRequest,
  buildUploadPreflightHttpPackageSha256,
  buildUploadPreflightHttpPackageSizeBytes,
  buildUploadPreflightHttpValidChunkedRequest as validChunkedRequest,
  installBuildUploadPreflightHttpHooks,
} from "./helpers/build-upload-preflight-http-harness";

const { preflight, releaseBuild, scan, uploadAsset } = mocks;

installBuildUploadPreflightHttpHooks();

describe("build upload HTTP size and chunked delivery", () => {
  it("returns a stable localized error code when the declared upload exceeds the limit", async () => {
    preflight.mockResolvedValueOnce({
      id: "prd_target",
      price: 0,
    });

    const response = await POST(oversizedDeclaredRequest(), context);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      code: "BUILD_UPLOAD_TOO_LARGE",
    });
    expect(scan).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
  });

  it("rejects an oversized chunked body without Content-Length before scanner or storage", async () => {
    preflight.mockResolvedValueOnce({
      id: "prd_target",
      price: 0,
    });
    const request = oversizedChunkedRequest();

    expect(request.headers.has("content-length")).toBe(false);
    const response = await POST(request, context);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      code: "BUILD_UPLOAD_TOO_LARGE",
    });
    expect(scan).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
  });

  it("accepts a valid chunked multipart upload without Content-Length", async () => {
    preflight.mockResolvedValueOnce({
      id: "prd_target",
      price: 0,
    });
    scan.mockResolvedValueOnce({
      status: "clean",
      scanner: "clamav",
      scannedAt: new Date("2026-09-28T00:00:00.000Z"),
    });
    uploadAsset.mockResolvedValueOnce({
      key: "assets/usr_attacker/resource.zip",
      sha256Hash: buildUploadPreflightHttpPackageSha256(),
      sizeBytes: buildUploadPreflightHttpPackageSizeBytes(),
    });
    releaseBuild.mockResolvedValueOnce({
      id: "bld_target",
      productId: "prd_target",
      version: "1.2.3",
      status: "pending_review",
    });
    const request = validChunkedRequest();

    expect(request.headers.has("content-length")).toBe(false);
    const response = await POST(request, context);

    expect(response.status).toBe(201);
    expect(scan).toHaveBeenCalledWith(expect.objectContaining({ fileName: "resource.zip" }));
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(releaseBuild).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "prd_target", version: "1.2.3" }),
      expect.objectContaining({ id: "usr_attacker" }),
      "tok_attacker",
    );
  });
});
