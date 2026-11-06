import { AppError } from "@nexus/domain";
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

import { GET as reviewer } from "../apps/web/src/app/api/admin/builds/[buildId]/download/route";
import {
  installResourceManagementHttpHooks,
  resourceManagementHttpRequest as request,
  resourceManagementHttpReviewFixture as reviewFixture,
  resourceManagementHttpState as state,
} from "./helpers/resource-management-http-harness";

installResourceManagementHttpHooks();

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
