import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_owner",
    username: "owner",
    displayName: "Owner",
    role: "developer",
  } as Record<string, unknown> | null,
}));

const command = vi.hoisted(() =>
  vi.fn(async () => ({
    id: "bld_1",
    productId: "prd_1",
    version: "1.0.0",
    status: "retired",
    revision: 4,
  })),
);

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("@nexus/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nexus/security")>();
  return {
    ...actual,
    consumeRateLimit: vi.fn(async () => ({ success: true })),
    generateId: () => "aud_test",
  };
});

vi.mock("../apps/web/src/lib/services/resource-build-workspace-service", () => ({
  resourceBuildWorkspaceService: { command, detail: vi.fn() },
}));

import { PATCH } from "../apps/web/src/app/api/products/[id]/builds/[buildId]/route";

const retireBody = {
  action: "retire" as const,
  expectedRevision: 3,
  reason: "No longer supported",
};

function request(body: unknown) {
  const value = new NextRequest(
    "http://nexus.test/api/products/prd_1/builds/bld_1",
    {
      method: "PATCH",
      headers: { ...browserMutationHeaders(), "content-type": "application/json" },
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    state.user = {
      id: "usr_owner",
      username: "owner",
      displayName: "Owner",
      role: "developer",
    };
    command.mockResolvedValue({
      id: "bld_1",
      productId: "prd_1",
      version: "1.0.0",
      status: "retired",
      revision: 4,
    });
  });

  it("requires authentication", async () => {
    state.user = null;
    const response = await PATCH(request(retireBody), context);

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    expect(command).not.toHaveBeenCalled();
  });

  it("validates the lifecycle action before calling the service", async () => {
    const response = await PATCH(
      request({ action: "restore", expectedRevision: 3, reason: "Wrong action" }),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ code: "BUILD_COMMAND_INVALID" });
    expect(command).not.toHaveBeenCalled();
  });

  it("returns the authoritative retired build from the service", async () => {
    const response = await PATCH(request(retireBody), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    expect(await response.json()).toEqual({
      build: {
        id: "bld_1",
        productId: "prd_1",
        version: "1.0.0",
        status: "retired",
        revision: 4,
      },
    });
    expect(command).toHaveBeenCalledWith(
      "prd_1",
      "bld_1",
      retireBody,
      expect.objectContaining({ id: "usr_owner" }),
    );
  });

  it("preserves service state-conflict codes", async () => {
    command.mockRejectedValueOnce(
      new AppError("This build is already retired", 409, "BUILD_ALREADY_RETIRED"),
    );

    const response = await PATCH(request(retireBody), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ code: "BUILD_ALREADY_RETIRED" });
  });
});
