import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, NotFoundError } from "@nexus/domain";

const preflight = vi.hoisted(() => vi.fn());
const releaseBuild = vi.hoisted(() => vi.fn());
const scan = vi.hoisted(() => vi.fn());
const uploadAsset = vi.hoisted(() => vi.fn());
const deleteAsset = vi.hoisted(() => vi.fn());

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_attacker",
      email: "attacker@nexus.test",
      username: "attacker",
      displayName: "Attacker",
      role: "user",
    })),
  },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    assertCanReleaseBuild: preflight,
    releaseBuild,
  },
}));

vi.mock("../apps/web/src/lib/services/build-scanner-service", () => ({
  buildScannerService: {
    scan,
  },
}));

vi.mock("@nexus/storage", () => ({
  MAX_FILE_SIZE_BYTES: 1024,
  storageService: {
    uploadAsset,
    deleteAsset,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: true,
    remaining: 9,
    resetAt: new Date(Date.now() + 60_000),
  })),
}));

import { POST } from "../apps/web/src/app/api/products/[id]/builds/route";

function invalidBodyRequest() {
  return new NextRequest(
    "http://nexus.test/api/products/prd_target/builds",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intentionally: "not multipart" }),
    },
  );
}

function oversizedDeclaredRequest() {
  return new NextRequest(
    "http://nexus.test/api/products/prd_target/builds",
    {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=nexus-boundary",
        "content-length": String(65 * 1024 * 1024 + 1),
      },
      body: "small test body",
    },
  );
}

function oversizedChunkedRequest() {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < 5; index += 1) {
        controller.enqueue(new Uint8Array(256 * 1024));
      }
      controller.close();
    },
  });

  return new NextRequest(
    "http://nexus.test/api/products/prd_target/builds",
    {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=nexus-boundary",
      },
      body,
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1],
  );
}

function validChunkedRequest() {
  const body = new TextEncoder().encode(
    '--nexus-boundary\r\nContent-Disposition: form-data; name="version"\r\n\r\n1.2.3\r\n' +
      '--nexus-boundary\r\nContent-Disposition: form-data; name="file"; filename="resource.zip"\r\n' +
      'Content-Type: application/zip\r\n\r\nPK\u0003\u0004\u0001\u0002\u0003\u0004\r\n' +
      '--nexus-boundary--\r\n',
  );
  const chunks = [body.slice(0, 23), body.slice(23, 71), body.slice(71)];

  return new NextRequest(
    "http://nexus.test/api/products/prd_target/builds",
    {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=nexus-boundary",
      },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      }),
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1],
  );
}

const context = {
  params: Promise.resolve({ id: "prd_target" }),
};

describe("build upload authorization HTTP preflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 before multipart parsing or expensive upload work for an unmanaged target", async () => {
    preflight.mockRejectedValueOnce(
      new ForbiddenError(
        "Not authorized to publish builds for this product",
      ),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

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
    preflight.mockRejectedValueOnce(
      new NotFoundError("Product", "prd_target"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

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
    const request = new NextRequest(
      "http://nexus.test/api/products/prd_target/builds",
      {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=nexus-boundary",
        },
        body: "not a multipart body",
      },
    );

    const response = await POST(request, context);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "BUILD_MULTIPART_INVALID",
    });
    expect(scan).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
  });

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
      sha256Hash: "a".repeat(64),
      sizeBytes: 8,
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
    expect(scan).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "resource.zip" }),
    );
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(releaseBuild).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "prd_target", version: "1.2.3" }),
      expect.objectContaining({ id: "usr_attacker" }),
    );
  });
});
