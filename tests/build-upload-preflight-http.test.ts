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
    expect(await response.json()).toEqual({
      error: "Build upload requires multipart/form-data",
    });
    expect(preflight).toHaveBeenCalledTimes(1);
    expect(scan).not.toHaveBeenCalled();
    expect(uploadAsset).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
    expect(releaseBuild).not.toHaveBeenCalled();
  });
});
