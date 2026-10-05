import { beforeAll, describe, expect, it } from "vitest";
import { buildRepository, productRepository, userRepository } from "@nexus/db";
import type { Build } from "@nexus/domain";
import { ProductService } from "../apps/web/src/lib/services/product-service";

describe("exact pending build retry lookup", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_retry_${suffix}`;
  const productId = `prd_retry_${suffix}`;
  const input = { productId, version: "1.2.3", releaseNotes: "\n\tOriginal release\nnotes \t\n", mtaVersionTarget: "1.6.0",
    sha256Hash: "a".repeat(64), fileSizeBytes: 8, fileName: "resource.zip", mimeType: "application/zip" };
  const base = { ...input, id: `bld_retry_${suffix}`, status: "pending_review" as const, storageKey: "assets/original.zip",
    scanStatus: "clean" as const, scanner: "test-scanner", scannedAt: new Date(), isSigned: false };

  beforeAll(async () => {
    await userRepository.create({ id: authorId, email: `retry_${suffix}@nexus.test`, username: `retry_${suffix}`,
      displayName: "Retry Author", role: "developer" });
    await productRepository.create({ id: productId, title: "Retry Resource", slug: `retry-${suffix}`,
      description: "Exact upload retry database verification.", type: "script", status: "draft", authorId, price: 0,
      currency: "USD", licenseModel: "unlimited", tags: [], currentVersion: "0.1.0", ratingAverage: 0,
      ratingCount: 0, salesCount: 0, isFeatured: false, screenshots: [], compatibility: { dependencies: [] } });
    await buildRepository.create(base);
  });

  it("finds the original clean pending build including identical raw multiline notes", async () => {
    expect(await buildRepository.findExactPendingRetry(input)).toMatchObject({ id: base.id, storageKey: "assets/original.zip" });
  });

  it("translates a real wrapped duplicate insert and recovers its original build without creating a second row", async () => {
    const actor = await userRepository.findById(authorId);
    if (!actor) throw new Error("Retry test author missing");
    const service = new ProductService();
    await expect(service.releaseBuild({ ...base, storageKey: "assets/redundant-retry.zip" }, actor))
      .rejects.toMatchObject({ statusCode: 409, code: "BUILD_VERSION_EXISTS" });
    expect(await service.recoverPendingBuildUpload(input, actor)).toMatchObject({ id: base.id });
    const matching = (await buildRepository.listByProduct(productId)).filter((build) => build.version === input.version);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.storageKey).toBe("assets/original.zip");
  });

  it.each([
    ["productId", "prd_other"], ["version", "1.2.4"], ["sha256Hash", "b".repeat(64)], ["fileSizeBytes", 9],
    ["fileName", "renamed.zip"], ["mimeType", "application/octet-stream"], ["releaseNotes", "Changed notes"],
    ["releaseNotes", input.releaseNotes.trim()], ["mtaVersionTarget", "1.5.9"],
  ] as const)("rejects changed %s", async (field, value) => {
    expect(await buildRepository.findExactPendingRetry({ ...input, [field]: value })).toBeNull();
  });

  it("treats missing and empty optional metadata alike", async () => {
    const noNotes = { ...base, id: `bld_empty_${suffix}`, version: "2.0.0", releaseNotes: undefined, mtaVersionTarget: undefined };
    await buildRepository.create(noNotes);
    expect(await buildRepository.findExactPendingRetry({ ...input, version: "2.0.0", releaseNotes: "", mtaVersionTarget: "" }))
      .toMatchObject({ id: noNotes.id });
  });

  it.each([
    { status: "draft" }, { status: "published" }, { status: "rejected" }, { status: "retired" },
    { scanStatus: "not_scanned", scanner: undefined, scannedAt: undefined }, { scanStatus: "error" },
    { scanStatus: "malicious" }, { scanStatus: "not_scanned", scanner: "legacy-scanner" },
  ].map((override, index) => ({ override: override as Partial<Build>, index })))("does not recover unsafe or no longer pending state %#", async ({ override, index }) => {
    const version = `3.0.0-${index}`;
    await buildRepository.create({ ...base, ...override, id: `bld_state_${suffix}_${index}`, version });
    expect(await buildRepository.findExactPendingRetry({ ...input, version })).toBeNull();
  });
});
