import { describe, expect, it } from "vitest";
import { auditRepository, supportCaseRepository, userRepository } from "@nexus/db";
import { supportMutationFingerprint } from "../apps/web/src/lib/support-idempotency";

describe("durable support mutation idempotency", () => {
  it("serializes two concurrent case creations and isolates a reused key by actor", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const actorId = `usr_idem_case_${suffix}`;
    const otherActorId = `usr_idem_other_${suffix}`;
    for (const [id, prefix] of [[actorId, "first"], [otherActorId, "other"]] as const) {
      await userRepository.create({
        id, email: `${prefix}_${suffix}@nexus.test`, username: `${prefix}_${suffix}`,
        displayName: "Idempotent Support User", role: "user",
      });
    }
    const requestKey = "12345678-1234-4234-8234-123456789abc";
    const fingerprint = supportMutationFingerprint({
      operation: "case", category: "account", subject: "Same request",
      message: "Create a case only once despite concurrent requests.",
    });

    const build = (id: string, userId: string) => {
      const messageId = `spm_${id}`;
      return supportCaseRepository.createIdempotentCase(
        { id, requesterId: userId, category: "account", subject: "Same request", status: "open" },
        { id: messageId, caseId: id, authorId: userId, authorRole: "requester", body: "Create a case only once despite concurrent requests." },
        { id: `aud_${id}`, actorId: userId, actorType: "user", action: "support.case.created", targetId: id, targetType: "support_case" },
        { actorId: userId, requestKey, operation: "case", fingerprint, caseId: id, messageId },
      );
    };
    const [left, right] = await Promise.all([
      build(`sup_idem_a_${suffix}`, actorId),
      build(`sup_idem_b_${suffix}`, actorId),
    ]);
    expect([left.kind, right.kind].sort()).toEqual(["created", "replayed"]);
    if (left.kind === "key_conflict" || right.kind === "key_conflict") throw new Error("Unexpected key collision");
    expect(left.supportCase.id).toBe(right.supportCase.id);
    expect(await supportCaseRepository.findById(left.supportCase.id)).not.toBeNull();
    expect(await supportCaseRepository.listMessages(left.supportCase.id)).toHaveLength(1);

    const audits = await auditRepository.listByActor(actorId, ["support.case.created"]);
    expect(audits.filter((event) => event.targetId === left.supportCase.id)).toHaveLength(1);

    const collision = await supportCaseRepository.createIdempotentCase(
      { id: `sup_idem_collision_${suffix}`, requesterId: actorId, category: "account", subject: "Other", status: "open" },
      { id: `spm_collision_${suffix}`, caseId: `sup_idem_collision_${suffix}`, authorId: actorId, authorRole: "requester", body: "Changed" },
      { id: `aud_collision_${suffix}`, actorId, actorType: "user", action: "support.case.created", targetId: `sup_idem_collision_${suffix}`, targetType: "support_case" },
      { actorId, requestKey, operation: "case", fingerprint: "f".repeat(64), caseId: `sup_idem_collision_${suffix}`, messageId: `spm_collision_${suffix}` },
    );
    expect(collision.kind).toBe("key_conflict");
    expect(await supportCaseRepository.findById(`sup_idem_collision_${suffix}`)).toBeNull();

    const independent = await build(`sup_idem_other_${suffix}`, otherActorId);
    expect(independent.kind).toBe("created");
    expect(independent.kind === "created" && independent.supportCase.id).not.toBe(left.supportCase.id);
  });

  it("replays a committed reply after closing without a second message or audit", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const actorId = `usr_idem_reply_${suffix}`;
    const caseId = `sup_idem_reply_${suffix}`;
    await userRepository.create({
      id: actorId, email: `reply_${suffix}@nexus.test`, username: `reply_${suffix}`,
      displayName: "Reply Idempotency User", role: "user",
    });
    await supportCaseRepository.createWithInitialMessage(
      { id: caseId, requesterId: actorId, category: "account", subject: "Retry case", status: "open" },
      { id: `spm_initial_${suffix}`, caseId, authorId: actorId, authorRole: "requester", body: "Initial request." },
      { id: `aud_initial_${suffix}`, actorId, actorType: "user", action: "support.case.created", targetId: caseId, targetType: "support_case" },
    );

    const key = "12345678-1234-4234-8234-123456789abd";
    const fingerprint = supportMutationFingerprint({
      operation: "reply", caseId, message: "Please retry exactly once.", expectedStatus: "open",
    });
    const send = (messageId: string) => supportCaseRepository.addIdempotentMessage(
      { id: messageId, caseId, authorId: actorId, authorRole: "requester", body: "Please retry exactly once.", expectedStatus: "open" },
      { id: `aud_${messageId}`, actorId, actorType: "user", action: "support.message.created", targetId: caseId, targetType: "support_case" },
      { actorId, requestKey: key, operation: "reply", fingerprint, caseId, messageId },
    );
    const [first, second] = await Promise.all([
      send(`spm_reply_a_${suffix}`),
      send(`spm_reply_b_${suffix}`),
    ]);
    expect([first.kind, second.kind].sort()).toEqual(["created", "replayed"]);
    if (first.kind !== "created" && first.kind !== "replayed") throw new Error("First reply failed");
    if (second.kind !== "created" && second.kind !== "replayed") throw new Error("Second reply failed");
    expect(first.message.id).toBe(second.message.id);
    expect(await supportCaseRepository.listMessages(caseId)).toHaveLength(2);

    const closed = await supportCaseRepository.updateStatus(
      caseId, "closed",
      { id: `aud_closed_${suffix}`, actorId, actorType: "admin", action: "support.case.status_changed", targetId: caseId, targetType: "support_case" },
      "open",
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
});
