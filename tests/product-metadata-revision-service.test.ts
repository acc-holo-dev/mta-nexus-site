import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({ updateManagedDetails: vi.fn(), findManaged: vi.fn() }));
vi.mock("@nexus/db", () => ({
  productRepository: mocks,
  buildRepository: {},
  organizationRepository: {},
}));
import { ProductService } from "../apps/web/src/lib/services/product-service";
const service = new ProductService();
const actor = { id: "author", role: "developer" } as User;
const details = {
  title: "New title",
  description: "Description",
  shortDescription: "Summary",
  tags: ["lua"],
};
const revision = new Date("2026-10-04T20:00:00.123Z");
beforeEach(() => vi.resetAllMocks());
it("passes revision and audit together into the repository", async () => {
  const product = { id: "resource", ...details };
  mocks.updateManagedDetails.mockResolvedValue(product);
  expect(await service.updateProductDetails("resource", details, actor, revision)).toBe(product);
  expect(mocks.updateManagedDetails).toHaveBeenCalledWith(
    "resource",
    actor,
    details,
    expect.objectContaining({
      actorId: actor.id,
      action: "product.details_updated",
      targetId: "resource",
    }),
    revision,
  );
  expect(mocks.findManaged).not.toHaveBeenCalled();
});
it("reports stale metadata only when current scope still permits management", async () => {
  mocks.updateManagedDetails.mockResolvedValue(null);
  mocks.findManaged.mockResolvedValue({ id: "resource" });
  await expect(
    service.updateProductDetails("resource", details, actor, revision),
  ).rejects.toMatchObject({
    statusCode: 409,
    code: "PRODUCT_METADATA_CONFLICT",
  });
  expect(mocks.findManaged).toHaveBeenCalledWith("resource", actor);
});
it("does not leak a conflict after access is revoked", async () => {
  mocks.updateManagedDetails.mockResolvedValue(null);
  mocks.findManaged.mockResolvedValue(null);
  await expect(
    service.updateProductDetails("resource", details, actor, revision),
  ).rejects.toMatchObject({
    statusCode: 404,
    code: "NOT_FOUND",
  });
});
it("preserves legacy writes without a revision", async () => {
  mocks.updateManagedDetails.mockResolvedValue(null);
  await expect(service.updateProductDetails("resource", details, actor)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(mocks.findManaged).not.toHaveBeenCalled();
});
