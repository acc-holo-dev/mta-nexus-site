import { Readable } from "node:stream";
import { AppError, NotFoundError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "developer" } as null | {
    id: string;
    role: "developer" | "moderator";
  },
  allowed: true,
  command: vi.fn(),
  managed: vi.fn(),
  candidates: vi.fn(),
  compatibility: vi.fn(),
  authorize: vi.fn(),
  download: vi.fn(),
  findBuild: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  resourceVariantsRepository: {
    command: state.command,
    managed: state.managed,
    candidates: state.candidates,
  },
  resourceCompatibilityRepository: { update: state.compatibility },
  buildReviewDownloadRepository: { authorize: state.authorize },
  buildRepository: { findById: state.findBuild },
}));
vi.mock("@nexus/security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nexus/security")>()),
  consumeRateLimit: vi.fn(async () => ({ success: state.allowed })),
}));
vi.mock("@nexus/storage", () => ({ storageService: { getDownloadStream: state.download } }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

import { consumeRateLimit } from "@nexus/security";
import { GET as reviewer } from "../apps/web/src/app/api/admin/builds/[buildId]/download/route";
import { POST as compatibility } from "../apps/web/src/app/api/products/[id]/compatibility/route";
import { GET as candidates } from "../apps/web/src/app/api/products/[id]/variants/candidates/route";
import {
  GET as managed,
  POST as variants,
} from "../apps/web/src/app/api/products/[id]/variants/route";

const context = { params: Promise.resolve({ id: "prd_a" }) },
  revision = "2026-10-10T00:00:00.000Z";
const command = {
  action: "save",
  expectedGroupId: null,
  expectedRevision: 0,
  title: "Resource variants",
  variants: [{ productId: "prd_a", label: "Base" }],
  reason: "Group the resources",
};
function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(
    `https://nexus.test${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          body: JSON.stringify(body),
          headers: { ...browserMutationHeaders(), "content-type": "application/json", ...headers },
        },
  );
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "developer" };
  state.allowed = true;
  for (const mock of [
    state.command,
    state.managed,
    state.candidates,
    state.compatibility,
    state.authorize,
    state.download,
    state.findBuild,
  ])
    mock.mockReset();
});
it("requires an account for all private management APIs", async () => {
  state.user = null;
  for (const run of [
    () => variants(request("/api/products/prd_a/variants", command), context),
    () => managed(request("/api/products/prd_a/variants"), context),
    () => candidates(request("/api/products/prd_a/variants/candidates"), context),
    () => compatibility(request("/api/products/prd_a/compatibility", {}), context),
  ]) {
    const response = await run();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
  expect(state.command).not.toHaveBeenCalled();
  expect(state.managed).not.toHaveBeenCalled();
});
it("rejects cross-site writes and incompatible media before parsing or mutation", async () => {
  expect(
    (
      await variants(
        request("/api/products/prd_a/variants", command, { "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await variants(
        request("/api/products/prd_a/variants", command, { "content-type": "text/plain" }),
        context,
      )
    ).status,
  ).toBe(415);
  expect(state.command).not.toHaveBeenCalled();
});
it("rate limits catalog management with the existing content policy", async () => {
  state.allowed = false;
  expect((await variants(request("/api/products/prd_a/variants", command), context)).status).toBe(
    429,
  );
  expect(consumeRateLimit).toHaveBeenCalledWith("contentCreation", "usr_a");
  expect(state.command).not.toHaveBeenCalled();
});
it("rejects overlong bodies and hidden publication/access fields", async () => {
  expect(
    (
      await variants(
        request("/api/products/prd_a/variants", { ...command, reason: "x".repeat(17_000) }),
        context,
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await variants(
        request("/api/products/prd_a/variants", { ...command, entitlements: ["product.download"] }),
        context,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await compatibility(
        request("/api/products/prd_a/compatibility", {
          expectedUpdatedAt: revision,
          compatibility: { dependencies: [], price: 0 },
        }),
        context,
      )
    ).status,
  ).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
  expect(state.compatibility).not.toHaveBeenCalled();
});
it("binds the actor and generated audit identity server-side and returns only committed confirmation", async () => {
  state.command.mockResolvedValue({ productId: "prd_a", groupId: "vgrp_new", revision: 1 });
  const response = await variants(request("/api/products/prd_a/variants", command), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.json()).toEqual({ productId: "prd_a", groupId: "vgrp_new", revision: 1 });
  expect(state.command).toHaveBeenCalledWith({
    productId: "prd_a",
    actorId: "usr_a",
    groupId: expect.stringMatching(/^vgrp_/),
    auditId: expect.stringMatching(/^aud_/),
    command,
  });
});
it("preserves private not-found and concurrency errors", async () => {
  state.managed.mockRejectedValue(new NotFoundError("Resource", "prd_a"));
  expect((await managed(request("/api/products/prd_a/variants"), context)).status).toBe(404);
  state.command.mockRejectedValue(
    new AppError("Private other group", 409, "RESOURCE_VARIANTS_CONFLICT"),
  );
  const response = await variants(request("/api/products/prd_a/variants", command), context);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ code: "RESOURCE_VARIANTS_CONFLICT" });
});
it("bounds candidate paging and rejects ambiguous repeated parameters", async () => {
  for (const query of ["page=0", "page=1001", "page=2.5", "page=2&page=3", "page=nope"])
    expect(
      (await candidates(request(`/api/products/prd_a/variants/candidates?${query}`), context))
        .status,
    ).toBe(400);
  expect(state.candidates).not.toHaveBeenCalled();
  state.candidates.mockResolvedValue({ candidates: [], page: 2, hasMore: false });
  expect(
    (await candidates(request("/api/products/prd_a/variants/candidates?page=2"), context)).status,
  ).toBe(200);
  expect(state.candidates).toHaveBeenCalledWith("prd_a", state.user, 2);
});
it("returns audited requirements without expanding the private product projection", async () => {
  const result = {
    id: "prd_a",
    updatedAt: revision,
    compatibility: { dependencies: ["resource-b"] },
  };
  state.compatibility.mockResolvedValue(result);
  const response = await compatibility(
    request("/api/products/prd_a/compatibility", {
      expectedUpdatedAt: revision,
      compatibility: { dependencies: [" Resource-B "] },
    }),
    context,
  );
  expect(await response.json()).toEqual({ product: result });
  expect(state.compatibility).toHaveBeenCalledWith({
    productId: "prd_a",
    actorId: "usr_a",
    auditId: expect.stringMatching(/^aud_/),
    expectedUpdatedAt: revision,
    compatibility: { dependencies: ["resource-b"] },
  });
});
function reviewFixture() {
  state.user = { id: "usr_mod", role: "moderator" };
  const build = {
    id: "bld_a",
    productId: "prd_a",
    version: "1.0.0",
    status: "pending_review",
    scanStatus: "clean",
    scanner: "scanner",
    scannedAt: new Date(revision),
    storageKey: "private/file.zip",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 4,
    fileName: "file.zip",
    mimeType: "application/zip",
  };
  const stream = Readable.from(Buffer.from("data"));
  state.findBuild.mockResolvedValue(build);
  state.download.mockResolvedValue({
    stream,
    meta: { sizeBytes: 4, sha256Hash: build.sha256Hash },
  });
  return { build, stream, context: { params: Promise.resolve({ buildId: "bld_a" }) } };
}
it("runs the final reviewer gate after opening storage and destroys bytes on a revoked grant", async () => {
  const fixture = reviewFixture();
  state.authorize.mockImplementation(async () => {
    expect(state.download).toHaveBeenCalledOnce();
    throw new AppError("Role revoked", 403, "FORBIDDEN");
  });
  const response = await reviewer(request("/api/admin/builds/bld_a/download"), fixture.context);
  expect(response.status).toBe(403);
  expect(fixture.stream.destroyed).toBe(true);
  expect(state.authorize).toHaveBeenCalledWith({
    actorId: "usr_mod",
    auditId: expect.stringMatching(/^aud_/),
    expected: fixture.build,
  });
  expect(response.headers.get("content-disposition")).toBeNull();
});
it("does not send bytes when the reviewer evidence changed during preparation", async () => {
  const fixture = reviewFixture();
  state.authorize.mockRejectedValue(new AppError("Artifact replaced", 409, "BUILD_STATE_CHANGED"));
  const response = await reviewer(request("/api/admin/builds/bld_a/download"), fixture.context);
  expect(response.status).toBe(409);
  expect(fixture.stream.destroyed).toBe(true);
  expect(await response.json()).toMatchObject({ code: "BUILD_STATE_CHANGED" });
});
it("delivers matching reviewer bytes only after final authorization succeeds", async () => {
  const fixture = reviewFixture();
  state.authorize.mockResolvedValue(undefined);
  const response = await reviewer(request("/api/admin/builds/bld_a/download"), fixture.context);
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("data");
  expect(state.authorize).toHaveBeenCalledOnce();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
