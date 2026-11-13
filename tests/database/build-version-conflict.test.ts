import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  normalizeResourceVersionForStorage,
  resourceVersionsConflict,
  type User,
} from "@nexus/domain";
const submitForReview = vi.hoisted(() => vi.fn());
const findExactPendingRetry = vi.hoisted(() => vi.fn());
vi.mock("@nexus/db", () => ({
  buildRepository: { submitForReview, findExactPendingRetry },
  productRepository: {},
  organizationRepository: {},
}));
import { ProductService } from "../../site/src/lib/services/product-service";

const input = {
  productId: "prd_target",
  version: "1.2.3",
  storageKey: "assets/retry.zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 8,
  fileName: "resource.zip",
  mimeType: "application/zip",
  scanStatus: "clean" as const,
  scanner: "test-scanner",
  scannedAt: new Date(),
};
const actor = { id: "usr_author", role: "developer" } as User;
function driverError(code = "23505", constraint_name = "builds_product_version_idx") {
  return Object.assign(new Error("PostgreSQL constraint violation"), { code, constraint_name });
}

describe("build version constraint error translation", () => {
  beforeEach(() => vi.clearAllMocks());
  async function attempt(error: unknown, version = input.version) {
    const service = new ProductService();
    vi.spyOn(service, "assertCanReleaseBuild").mockResolvedValue({ id: "prd_target" } as never);
    submitForReview.mockRejectedValueOnce(error);
    return service.releaseBuild({ ...input, version }, actor, "author-session");
  }

  it.each([
    driverError(),
    new DrizzleQueryError("insert into builds", [], driverError()),
    new Error("transaction failed", {
      cause: new DrizzleQueryError("insert into builds", [], driverError()),
    }),
  ])("maps the exact product/version constraint through driver wrappers %#", async (error) => {
    await expect(attempt(error)).rejects.toMatchObject({
      statusCode: 409,
      code: "BUILD_VERSION_EXISTS",
    });
  });

  it.each([
    driverError("23505", "builds_pkey"),
    driverError("23505", "audit_events_pkey"),
    driverError("23503"),
    Object.assign(new Error("unknown uniqueness failure"), { code: "23505" }),
    new DrizzleQueryError("insert into builds", [], driverError("23505", "builds_pkey")),
  ])("preserves unrelated database errors %#", async (error) => {
    await expect(attempt(error)).rejects.toBe(error);
  });

  it("terminates on a cyclic cause without misclassifying it", async () => {
    const error = new Error("cyclic cause");
    error.cause = error;
    await expect(attempt(error)).rejects.toBe(error);
  });

  it("stores and retries new releases without optional leading v so duplicates share one identity", async () => {
    expect(resourceVersionsConflict("v1.2.3", "1.2.3")).toBe(true);
    expect(normalizeResourceVersionForStorage("v1.2.3")).toBe("1.2.3");

    const service = new ProductService();
    vi.spyOn(service, "assertCanReleaseBuild").mockResolvedValue({ id: "prd_target" } as never);
    await expect(attempt(driverError(), "v1.2.3")).rejects.toMatchObject({
      code: "BUILD_VERSION_EXISTS",
    });
    expect(submitForReview).toHaveBeenCalledWith(
      expect.objectContaining({ version: "1.2.3" }),
      expect.any(Object),
      "author-session",
    );

    findExactPendingRetry.mockResolvedValueOnce({ id: "bld_existing", version: "1.2.3" });
    await expect(
      service.recoverPendingBuildUpload(
        {
          productId: "prd_target",
          version: "v1.2.3",
          sha256Hash: input.sha256Hash,
          fileSizeBytes: input.fileSizeBytes,
          fileName: input.fileName,
          mimeType: input.mimeType,
        },
        actor,
      ),
    ).resolves.toMatchObject({ id: "bld_existing" });
    expect(findExactPendingRetry).toHaveBeenCalledWith(
      expect.objectContaining({ version: "1.2.3" }),
    );
  });
});
