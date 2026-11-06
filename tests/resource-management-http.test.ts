import { AppError, NotFoundError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createResourceManagementHttpDbMock } = await import(
    "./helpers/resource-management-http-harness"
  );
  return createResourceManagementHttpDbMock();
});
vi.mock("@nexus/security", async (importOriginal) => {
  const { createResourceManagementHttpSecurityMock } = await import(
    "./helpers/resource-management-http-harness"
  );
  return createResourceManagementHttpSecurityMock(importOriginal);
});
vi.mock("@nexus/storage", async () => {
  const { createResourceManagementHttpStorageMock } = await import(
    "./helpers/resource-management-http-harness"
  );
  return createResourceManagementHttpStorageMock();
});
vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { createResourceManagementHttpAuthMock } = await import(
    "./helpers/resource-management-http-harness"
  );
  return createResourceManagementHttpAuthMock();
});
vi.mock("../apps/web/src/lib/services/product-service", async () => {
  const { createResourceManagementHttpProductMock } = await import(
    "./helpers/resource-management-http-harness"
  );
  return createResourceManagementHttpProductMock();
});

import { consumeRateLimit } from "@nexus/security";
import {
  POST as compatibility,
  GET as readCompatibility,
} from "../apps/web/src/app/api/products/[id]/compatibility/route";
import { GET as candidates } from "../apps/web/src/app/api/products/[id]/variants/candidates/route";
import {
  GET as managed,
  POST as variants,
} from "../apps/web/src/app/api/products/[id]/variants/route";
import { browserMutationHeaders } from "./browser-mutation-headers";
import {
  resourceManagementHttpCommand as command,
  resourceManagementHttpContext as context,
  installResourceManagementHttpHooks,
  resourceManagementHttpRequest as request,
  resourceManagementHttpRevision as revision,
  resourceManagementHttpState as state,
} from "./helpers/resource-management-http-harness";

installResourceManagementHttpHooks();

it("requires an account for all private management APIs", async () => {
  state.user = null;
  for (const run of [
    () => variants(request("/api/products/prd_a/variants", command), context),
    () => managed(request("/api/products/prd_a/variants"), context),
    () => candidates(request("/api/products/prd_a/variants/candidates"), context),
    () => compatibility(request("/api/products/prd_a/compatibility", {}), context),
    () => readCompatibility(request("/api/products/prd_a/compatibility"), context),
  ]) {
    const response = await run();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
  expect(state.command).not.toHaveBeenCalled();
  expect(state.managed).not.toHaveBeenCalled();
});

it("returns only the authorized actor's current compatibility and denies lost access", async () => {
  state.findManagedProduct
    .mockResolvedValueOnce({
      id: "prd_a",
      updatedAt: new Date(revision),
      status: "published",
      compatibility: { mtaMinVersion: "1.6.0", dependencies: ["resource-b"], secret: "private" },
      privateField: "must-not-serialize",
    })
    .mockResolvedValueOnce(null);
  const response = await readCompatibility(request("/api/products/prd_a/compatibility"), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({
    actorId: "usr_a",
    product: {
      id: "prd_a",
      updatedAt: revision,
      suspended: false,
      compatibility: { mtaMinVersion: "1.6.0", dependencies: ["resource-b"] },
    },
  });
  expect(state.findManagedProduct).toHaveBeenCalledWith("prd_a", state.user);
  const denied = await readCompatibility(request("/api/products/prd_a/compatibility"), context);
  expect(denied.status).toBe(404);
});

it("rate-limits private compatibility reads before fetching managed details", async () => {
  state.allowed = false;
  const response = await readCompatibility(request("/api/products/prd_a/compatibility"), context);
  expect(response.status).toBe(429);
  expect(state.findManagedProduct).not.toHaveBeenCalled();
});

it("rejects missing or changed actor preconditions before compatibility writes", async () => {
  const body = { expectedUpdatedAt: revision, compatibility: { dependencies: [] } };
  const missing = new NextRequest("https://nexus.test/api/products/prd_a/compatibility", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { ...browserMutationHeaders(), "content-type": "application/json" },
  });
  expect((await compatibility(missing, context)).status).toBe(428);
  const changed = await compatibility(
    request("/api/products/prd_a/compatibility", body, { "x-nexus-actor-id": "usr_other" }),
    context,
  );
  expect(changed.status).toBe(409);
  expect(await changed.json()).toEqual({ code: "ACTOR_CHANGED" });
  expect(state.compatibility).not.toHaveBeenCalled();
});

it("binds variant reads and writes to the active actor", async () => {
  state.managed.mockResolvedValue({ anchorProductId: "prd_a", group: null });
  const read = await managed(request("/api/products/prd_a/variants"), context);
  expect(read.status).toBe(200);
  expect(read.headers.get("x-nexus-actor-id")).toBe("usr_a");
  expect(read.headers.get("cache-control")).toBe("private, no-store");
  expect(await read.json()).toEqual({ anchorProductId: "prd_a", group: null });
  state.candidates.mockResolvedValue({ candidates: [], page: 1, hasMore: false });
  const candidateRead = await candidates(
    request("/api/products/prd_a/variants/candidates"),
    context,
  );
  expect(candidateRead.headers.get("x-nexus-actor-id")).toBe("usr_a");
  expect(candidateRead.headers.get("cache-control")).toBe("private, no-store");
  const missing = new NextRequest("https://nexus.test/api/products/prd_a/variants", {
    method: "POST",
    body: JSON.stringify(command),
    headers: { ...browserMutationHeaders(), "content-type": "application/json" },
  });
  expect((await variants(missing, context)).status).toBe(428);
  const changed = await variants(
    request("/api/products/prd_a/variants", command, { "x-nexus-actor-id": "usr_other" }),
    context,
  );
  expect(changed.status).toBe(409);
  expect(await changed.json()).toEqual({ code: "ACTOR_CHANGED" });
  expect(state.command).not.toHaveBeenCalled();
});

it("rate-limits private variant and candidate reads before repository access", async () => {
  state.allowed = false;
  expect((await managed(request("/api/products/prd_a/variants"), context)).status).toBe(429);
  expect(
    (await candidates(request("/api/products/prd_a/variants/candidates"), context)).status,
  ).toBe(429);
  expect(state.managed).not.toHaveBeenCalled();
  expect(state.candidates).not.toHaveBeenCalled();
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
