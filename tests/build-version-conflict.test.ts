import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";
import type { User } from "@nexus/domain";
const submitForReview = vi.hoisted(() => vi.fn());
vi.mock("@nexus/db", () => ({ buildRepository: { submitForReview }, productRepository: {}, organizationRepository: {} }));
import { ProductService } from "../apps/web/src/lib/services/product-service";

const input = { productId: "prd_target", version: "1.2.3", storageKey: "assets/retry.zip", sha256Hash: "a".repeat(64),
  fileSizeBytes: 8, fileName: "resource.zip", mimeType: "application/zip", scanStatus: "clean" as const,
  scanner: "test-scanner", scannedAt: new Date() };
const actor = { id: "usr_author", role: "developer" } as User;
function driverError(code = "23505", constraint_name = "builds_product_version_idx") {
  return Object.assign(new Error("PostgreSQL constraint violation"), { code, constraint_name });
}

describe("build version constraint error translation", () => {
  beforeEach(() => vi.clearAllMocks());
  async function attempt(error: unknown) {
    const service = new ProductService();
    vi.spyOn(service, "assertCanReleaseBuild").mockResolvedValue({ id: "prd_target" } as never);
    submitForReview.mockRejectedValueOnce(error);
    return service.releaseBuild(input, actor);
  }

  it.each([
    driverError(), new DrizzleQueryError("insert into builds", [], driverError()),
    new Error("transaction failed", { cause: new DrizzleQueryError("insert into builds", [], driverError()) }),
  ])("maps the exact product/version constraint through driver wrappers %#", async (error) => {
    await expect(attempt(error)).rejects.toMatchObject({ statusCode: 409, code: "BUILD_VERSION_EXISTS" });
  });

  it.each([
    driverError("23505", "builds_pkey"), driverError("23505", "audit_events_pkey"),
    driverError("23503"), Object.assign(new Error("unknown uniqueness failure"), { code: "23505" }),
    new DrizzleQueryError("insert into builds", [], driverError("23505", "builds_pkey")),
  ])("preserves unrelated database errors %#", async (error) => {
    await expect(attempt(error)).rejects.toBe(error);
  });

  it("terminates on a cyclic cause without misclassifying it", async () => {
    const error = new Error("cyclic cause");
    error.cause = error;
    await expect(attempt(error)).rejects.toBe(error);
  });
});
