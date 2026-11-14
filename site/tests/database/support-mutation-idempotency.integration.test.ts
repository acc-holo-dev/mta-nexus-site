import { randomUUID as sessionUUID } from "node:crypto";
import {
  auditRepository,
  buildRepository,
  productRepository,
  supportCaseRepository,
  sessionRepository as supportSessions,
  userRepository,
} from "@nexus/db";
import { describe, expect, it } from "vitest";
import { supportMutationFingerprint } from "../../src/lib/support-idempotency";
import { createSupportCaseSchema } from "@nexus/validation";

describe("durable support mutation idempotency", () => {
  it("serializes two concurrent case creations and isolates a reused key by actor", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const actorId = `usr_idem_case_${suffix}`;
    const otherActorId = `usr_idem_other_${suffix}`;
    for (const [id, prefix] of [
      [actorId, "first"],
      [otherActorId, "other"],
    ] as const) {
      await userRepository.create({
        id,
        email: `${prefix}_${suffix}@nexus.test`,
        username: `${prefix}_${suffix}`,
        displayName: "Idempotent Support User",
        role: "user",
      });
    }
    const requestKey = "12345678-1234-4234-8234-123456789abc";
    const fingerprint = supportMutationFingerprint({
      operation: "case",
      category: "account",
      subject: "Same request",
      message: "Create a case only once despite concurrent requests.",
    });

    const build = async (id: string, userId: string) => {
      const messageId = `spm_${id}`;
      return supportCaseRepository.createIdempotentCase(
        { id, requesterId: userId, category: "account", subject: "Same request", status: "open" },
        {
          id: messageId,
          caseId: id,
          authorId: userId,
          authorRole: "requester",
          body: "Create a case only once despite concurrent requests.",
        },
        {
          id: `aud_${id}`,
          actorId: userId,
          actorType: "user",
          action: "support.case.created",
          targetId: id,
          targetType: "support_case",
        },
        { actorId: userId, requestKey, operation: "case", fingerprint, caseId: id, messageId },
        await initiatingToken(userId),
      );
    };
    const [left, right] = await Promise.all([
      build(`sup_idem_a_${suffix}`, actorId),
      build(`sup_idem_b_${suffix}`, actorId),
    ]);
    expect([left.kind, right.kind].sort()).toEqual(["created", "replayed"]);
    if (left.kind === "key_conflict" || right.kind === "key_conflict")
      throw new Error("Unexpected key collision");
    expect(left.supportCase.id).toBe(right.supportCase.id);
    expect(await supportCaseRepository.findById(left.supportCase.id)).not.toBeNull();
    expect(await supportCaseRepository.listMessages(left.supportCase.id)).toHaveLength(1);

    const audits = await auditRepository.listByActor(actorId, ["support.case.created"]);
    expect(audits.filter((event) => event.targetId === left.supportCase.id)).toHaveLength(1);

    const collision = await supportCaseRepository.createIdempotentCase(
      {
        id: `sup_idem_collision_${suffix}`,
        requesterId: actorId,
        category: "account",
        subject: "Other",
        status: "open",
      },
      {
        id: `spm_collision_${suffix}`,
        caseId: `sup_idem_collision_${suffix}`,
        authorId: actorId,
        authorRole: "requester",
        body: "Changed",
      },
      {
        id: `aud_collision_${suffix}`,
        actorId,
        actorType: "user",
        action: "support.case.created",
        targetId: `sup_idem_collision_${suffix}`,
        targetType: "support_case",
      },
      {
        actorId,
        requestKey,
        operation: "case",
        fingerprint: "f".repeat(64),
        caseId: `sup_idem_collision_${suffix}`,
        messageId: `spm_collision_${suffix}`,
      },
      await initiatingToken(actorId),
    );
    expect(collision.kind).toBe("key_conflict");
    expect(await supportCaseRepository.findById(`sup_idem_collision_${suffix}`)).toBeNull();

    const independent = await build(`sup_idem_other_${suffix}`, otherActorId);
    expect(independent.kind).toBe("created");
    expect(independent.kind === "created" && independent.supportCase.id).not.toBe(
      left.supportCase.id,
    );
  });

  it("replays a committed reply after closing without a second message or audit", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const actorId = `usr_idem_reply_${suffix}`;
    const staffId = `usr_idem_reply_staff_${suffix}`;
    const caseId = `sup_idem_reply_${suffix}`;
    await userRepository.create({
      id: actorId,
      email: `reply_${suffix}@nexus.test`,
      username: `reply_${suffix}`,
      displayName: "Reply Idempotency User",
      role: "user",
    });
    await userRepository.create({
      id: staffId,
      email: `reply_staff_${suffix}@nexus.test`,
      username: `reply_staff_${suffix}`,
      displayName: "Reply Idempotency Staff",
      role: "moderator",
    });
    await supportCaseRepository.createWithInitialMessage(
      {
        id: caseId,
        requesterId: actorId,
        category: "account",
        subject: "Retry case",
        status: "open",
      },
      {
        id: `spm_initial_${suffix}`,
        caseId,
        authorId: actorId,
        authorRole: "requester",
        body: "Initial request.",
      },
      {
        id: `aud_initial_${suffix}`,
        actorId,
        actorType: "user",
        action: "support.case.created",
        targetId: caseId,
        targetType: "support_case",
      },
    );

    const key = "12345678-1234-4234-8234-123456789abd";
    const fingerprint = supportMutationFingerprint({
      operation: "reply",
      caseId,
      message: "Please retry exactly once.",
      expectedStatus: "open",
    });
    const send = async (messageId: string) =>
      supportCaseRepository.addIdempotentMessage(
        {
          id: messageId,
          caseId,
          authorId: actorId,
          authorRole: "requester",
          body: "Please retry exactly once.",
          expectedStatus: "open",
        },
        {
          id: `aud_${messageId}`,
          actorId,
          actorType: "user",
          action: "support.message.created",
          targetId: caseId,
          targetType: "support_case",
        },
        { actorId, requestKey: key, operation: "reply", fingerprint, caseId, messageId },
        await initiatingToken(actorId),
      );
    const [first, second] = await Promise.all([
      send(`spm_reply_a_${suffix}`),
      send(`spm_reply_b_${suffix}`),
    ]);
    expect([first.kind, second.kind].sort()).toEqual(["created", "replayed"]);
    if (first.kind !== "created" && first.kind !== "replayed")
      throw new Error("First reply failed");
    if (second.kind !== "created" && second.kind !== "replayed")
      throw new Error("Second reply failed");
    expect(first.message.id).toBe(second.message.id);
    expect(await supportCaseRepository.listMessages(caseId)).toHaveLength(2);

    const closed = await supportCaseRepository.updateStatus(
      caseId,
      "closed",
      {
        id: `aud_closed_${suffix}`,
        actorId: staffId,
        actorType: "admin",
        action: "support.case.status_changed",
        targetId: caseId,
        targetType: "support_case",
      },
      "open",
      await initiatingToken(staffId),
    );
    expect(closed?.status).toBe("closed");
    const replayed = await send(`spm_reply_retry_${suffix}`);
    expect(replayed.kind).toBe("replayed");
    if (replayed.kind === "replayed") {
      expect(replayed.supportCase.status).toBe("closed");
      expect(replayed.message.id).toBe(first.message.id);
    }
    expect((await supportCaseRepository.findById(caseId))?.status).toBe("closed");
    expect(await supportCaseRepository.listMessages(caseId)).toHaveLength(2);
    const audits = await auditRepository.listByActor(actorId, ["support.message.created"]);
    expect(audits.filter((event) => event.targetId === caseId)).toHaveLength(1);
  });

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

async function initiatingToken(userId: string) {
  const token = sessionUUID();
  await supportSessions.create({
    id: `ses_${sessionUUID()}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
}
