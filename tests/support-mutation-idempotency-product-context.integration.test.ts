import {
  buildRepository,
  productRepository,
  supportCaseRepository,
  userRepository,
} from "@nexus/db";
import { createSupportCaseSchema } from "@nexus/validation";
import { describe, expect, it } from "vitest";
import { supportMutationFingerprint } from "../apps/web/src/lib/support-idempotency";
import { initiatingToken } from "./helpers/support-mutation-idempotency-harness";

describe("durable support product-context idempotency", () => {
  it("attaches verified product context and rejects a tampered product id", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const actorId = `usr_ctx_${suffix}`;
    const productId = `prd_${"a".repeat(24)}`;
    const buildId = `bld_${"b".repeat(24)}`;
    const foreignProduct = `prd_${"c".repeat(24)}`;
    await userRepository.create({
      id: actorId,
      email: `ctx_${suffix}@nexus.test`,
      username: `ctx_${suffix}`,
      displayName: "Context Support User",
      role: "developer",
    });
    await productRepository.create({
      id: productId,
      title: "Context resource",
      slug: `ctx-${suffix}`,
      description: "Support object context fixture",
      authorId: actorId,
      type: "script",
      status: "published",
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: [],
      screenshots: [],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      compatibility: { dependencies: [] },
    });
    await buildRepository.create({
      id: buildId,
      productId,
      version: "1.0.0",
      status: "published",
      scanStatus: "clean",
      scanner: "integration-scanner",
      scannedAt: new Date(),
      fileName: "fixture.zip",
      mimeType: "application/zip",
      fileSizeBytes: 7,
      sha256Hash: "a".repeat(64),
      storageKey: `private/ctx-${suffix}.zip`,
      isSigned: false,
    });

    expect(
      createSupportCaseSchema.safeParse({
        category: "resource",
        subject: "Download failed for this build",
        message: "The handoff finished but the archive is incomplete.",
        context: { productId, buildId },
      }).success,
    ).toBe(true);
    expect(
      createSupportCaseSchema.safeParse({
        category: "purchase",
        subject: "Order context must be verified",
        message: "A client must not attach an arbitrary purchase to a support case.",
        relatedType: "purchase",
        relatedId: "ord_someone_else",
      }).success,
    ).toBe(false);

    const caseId = `sup_ctx_ok_${suffix}`;
    const messageId = `spm_ctx_ok_${suffix}`;
    const fingerprint = supportMutationFingerprint({
      operation: "case",
      category: "resource",
      subject: "Download failed for this build",
      message: "The handoff finished but the archive is incomplete.",
      context: { productId, buildId },
    });
    const created = await supportCaseRepository.createIdempotentCase(
      {
        id: caseId,
        requesterId: actorId,
        category: "resource",
        subject: "Download failed for this build",
        status: "open",
      },
      {
        id: messageId,
        caseId,
        authorId: actorId,
        authorRole: "requester",
        body: "The handoff finished but the archive is incomplete.",
      },
      {
        id: `aud_ctx_ok_${suffix}`,
        actorId,
        actorType: "user",
        action: "support.case.created",
        targetId: caseId,
        targetType: "support_case",
        details: { category: "resource" },
      },
      {
        actorId,
        requestKey: "12345678-1234-4234-8234-123456789abe",
        operation: "case",
        fingerprint,
        caseId,
        messageId,
      },
      await initiatingToken(actorId),
      { productId, buildId },
    );
    expect(created.kind).toBe("created");
    if (created.kind !== "created") throw new Error("expected create");
    expect(created.supportCase.relatedType).toBe("product");
    expect(created.supportCase.relatedId).toBe(productId);

    const tamperedId = `sup_ctx_bad_${suffix}`;
    await expect(
      supportCaseRepository.createIdempotentCase(
        {
          id: tamperedId,
          requesterId: actorId,
          category: "resource",
          subject: "Tampered context must fail",
          status: "open",
        },
        {
          id: `spm_ctx_bad_${suffix}`,
          caseId: tamperedId,
          authorId: actorId,
          authorRole: "requester",
          body: "This product is not part of the actor situation.",
        },
        {
          id: `aud_ctx_bad_${suffix}`,
          actorId,
          actorType: "user",
          action: "support.case.created",
          targetId: tamperedId,
          targetType: "support_case",
        },
        {
          actorId,
          requestKey: "12345678-1234-4234-8234-123456789abf",
          operation: "case",
          fingerprint: "e".repeat(64),
          caseId: tamperedId,
          messageId: `spm_ctx_bad_${suffix}`,
        },
        await initiatingToken(actorId),
        { productId: foreignProduct, buildId },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await supportCaseRepository.findById(tamperedId)).toBeNull();
  });
});
