import { auditRepository, supportCaseRepository, userRepository } from "@nexus/db";
import { describe, expect, it } from "vitest";
import { supportMutationFingerprint } from "../apps/web/src/lib/support-idempotency";
import { initiatingToken } from "./helpers/support-mutation-idempotency-harness";

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
});
