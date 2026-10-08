import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_owner",
    username: "owner",
    displayName: "Owner",
    role: "developer",
  } as Record<string, unknown> | null,
}));

const retireBuild = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "bld_1",
    productId: "prd_1",
    version: "1.0.0",
    status: "retired",
  })),
);

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { retireBuild },
}));

import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { PATCH } from "../apps/web/src/app/api/products/[id]/builds/[buildId]/route";

function request(body: unknown) {
  const value = new NextRequest(
    "http://nexus.test/api/products/prd_1/builds/bld_1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  value.cookies.set("nexus_session", "test-session");
  return value;
}

const context = {
  params: Promise.resolve({ id: "prd_1", buildId: "bld_1" }),
};

describe("build retirement HTTP behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = {
      id: "usr_owner",
      username: "owner",
      displayName: "Owner",
      role: "developer",
    };
    retireBuild.mockResolvedValue({
      id: "bld_1",
      productId: "prd_1",
      version: "1.0.0",
      status: "retired",
    });
  });

  it("requires authentication", async () => {
    state.user = null;
    const response = await PATCH(
      request({ action: "retire", reason: "No longer supported" }),
      context,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(retireBuild).not.toHaveBeenCalled();
  });

  it("validates the lifecycle action before calling the service", async () => {
    const response = await PATCH(
      request({ action: "restore", reason: "Wrong action" }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid build lifecycle action",
    });
    expect(retireBuild).not.toHaveBeenCalled();
  });

  it("returns the authoritative retired build from the service", async () => {
    const response = await PATCH(
      request({ action: "retire", reason: "No longer supported" }),
      context,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(await response.json()).toEqual({
      build: {
        id: "bld_1",
        productId: "prd_1",
        version: "1.0.0",
        status: "retired",
      },
    });
    expect(retireBuild).toHaveBeenCalledWith(
      {
        productId: "prd_1",
        buildId: "bld_1",
        reason: "No longer supported",
      },
      expect.objectContaining({ id: "usr_owner" }),
    );
  });

  it("preserves service state-conflict codes", async () => {
    retireBuild.mockRejectedValueOnce(
      new AppError(
        "This build is already retired",
        409,
        "BUILD_ALREADY_RETIRED",
      ),
    );

    const response = await PATCH(
      request({ action: "retire", reason: "No longer supported" }),
      context,
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "This build is already retired",
      code: "BUILD_ALREADY_RETIRED",
    });
  });
});
