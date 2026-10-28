import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@nexus/domain";
import type { Build, User } from "@nexus/domain";
const findExactPendingRetry = vi.hoisted(() => vi.fn());
vi.mock("@nexus/db", () => ({
  buildRepository: { findExactPendingRetry },
  productRepository: {},
  organizationRepository: {},
}));
import { ProductService } from "../apps/web/src/lib/services/product-service";

describe("pending upload retry authorization", () => {
  beforeEach(() => vi.clearAllMocks());
  const input = {
    productId: "prd_target",
    version: "1.2.3",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 8,
    fileName: "resource.zip",
    mimeType: "application/zip",
  };
  const actor = { id: "usr_author", role: "developer" } as User;

  it("reauthorizes before looking up the existing build", async () => {
    const service = new ProductService();
    const authorize = vi
      .spyOn(service, "assertCanReleaseBuild")
      .mockResolvedValue({ id: "prd_target" } as never);
    findExactPendingRetry.mockResolvedValue({ id: "bld_original" } as Build);
    expect(await service.recoverPendingBuildUpload(input, actor)).toMatchObject({
      id: "bld_original",
    });
    expect(authorize).toHaveBeenCalledWith("prd_target", actor);
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(
      findExactPendingRetry.mock.invocationCallOrder[0],
    );
    expect(findExactPendingRetry).toHaveBeenCalledWith(input);
  });

  it("does not reveal existing uploads to actors who lost management access", async () => {
    const service = new ProductService();
    vi.spyOn(service, "assertCanReleaseBuild").mockRejectedValue(
      new ForbiddenError("Not authorized"),
    );
    await expect(service.recoverPendingBuildUpload(input, actor)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(findExactPendingRetry).not.toHaveBeenCalled();
  });
});
