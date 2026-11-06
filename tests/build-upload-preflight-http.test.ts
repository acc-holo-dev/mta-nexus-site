import { ForbiddenError, NotFoundError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { browserMutationHeaders } from "./browser-mutation-headers";

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
  buildUploadPreflightHttpInvalidBodyRequest as invalidBodyRequest,
  buildUploadPreflightHttpMocks as mocks,
  installBuildUploadPreflightHttpHooks,
} from "./helpers/build-upload-preflight-http-harness";

const { preflight, releaseBuild, scan, uploadAsset, deleteAsset } = mocks;

installBuildUploadPreflightHttpHooks();

describe("build upload authorization HTTP preflight", () => {
  it("returns 403 before multipart parsing or expensive upload work for an unmanaged target", async () => {
    preflight.mockRejectedValueOnce(
      new ForbiddenError("Not authorized to publish builds for this product"),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = await POST(invalidBodyRequest(), context);

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: "Not authorized to publish builds for this product",
      });
      expect(preflight).toHaveBeenCalledTimes(1);
      expect(scan).not.toHaveBeenCalled();
      expect(uploadAsset).not.toHaveBeenCalled();
      expect(deleteAsset).not.toHaveBeenCalled();
      expect(releaseBuild).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("returns 404 before multipart parsing when the product target does not exist", async () => {
    preflight.mockRejectedValueOnce(new NotFoundError("Product", "prd_target"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = await POST(invalidBodyRequest(), context);

      expect(response.status).toBe(404);
      expect(scan).not.toHaveBeenCalled();
      expect(uploadAsset).not.toHaveBeenCalled();
      expect(releaseBuild).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("returns 415 after successful preflight but before multipart parsing for the wrong media type", async () => {
    preflight.mockResolvedValueOnce({
      id: "prd_target",
      price: 0,
    });

    const response = await POST(invalidBodyRequest(), context);

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      error: "Build upload requires multipart/form-data",
      code: "BUILD_MULTIPART_REQUIRED",
    });
    expect(preflight).toHaveBeenCalledTimes(1);
    expect(scan).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
  });

  it("returns a stable error code for malformed multipart input", async () => {
    preflight.mockResolvedValueOnce({
      id: "prd_target",
      price: 0,
    });
    const request = new NextRequest("http://nexus.test/api/products/prd_target/builds", {
      method: "POST",
      headers: browserMutationHeaders({
        cookie: "nexus_session=tok_attacker",
        "x-nexus-actor-id": "usr_attacker",
        "content-type": "multipart/form-data; boundary=nexus-boundary",
      }),
      body: "not a multipart body",
    });

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "BUILD_MULTIPART_INVALID",
    });
    expect(scan).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
  });
});
