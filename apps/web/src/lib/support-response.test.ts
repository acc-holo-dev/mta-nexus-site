import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  confirmSupportCaseCreated,
  confirmSupportReply,
  confirmSupportStatusChanged,
  parseSupportCaseList,
  parseSupportThread,
} from "./support-response";

const caseId = "sup_" + "a".repeat(24);
const anotherId = "sup_" + "b".repeat(24);
const messageId = "spm_" + "c".repeat(24);
const timestamp = "2026-10-08T05:00:00.000Z";
const supportCase = {
  id: caseId,
  category: "account",
  subject: "Account access",
  status: "open" as const,
  updatedAt: timestamp,
};
const message = {
  id: messageId,
  caseId,
  authorRole: "requester" as const,
  body: "I still need assistance",
  createdAt: timestamp,
};

describe("support API client confirmations", () => {
  it("parses valid case list and thread without leaking unrelated fields", () => {
    assert.deepEqual(parseSupportCaseList({ cases: [{ ...supportCase, requesterUsername: "alice", requesterId: "hidden" }] }), [
      { ...supportCase, requesterUsername: "alice" },
    ]);
    assert.deepEqual(parseSupportThread({ supportCase, messages: [{ ...message, authorId: "hidden" }] }, caseId), {
      supportCase: { id: caseId, category: "account", subject: "Account access", status: "open" },
      messages: [message],
    });
  });

  it("rejects invalid dates, malformed identifiers and incomplete payloads before UI rendering", () => {
    assert.equal(parseSupportCaseList({ cases: [{ ...supportCase, updatedAt: "invalid" }] }), null);
    assert.equal(parseSupportCaseList({ cases: [{ ...supportCase, updatedAt: "2026-02-31T05:00:00.000Z" }] }), null);
    assert.equal(parseSupportCaseList({ cases: Array.from({ length: 101 }, () => supportCase) }), null);
    assert.equal(parseSupportCaseList({ cases: [{ ...supportCase, id: "../other" }] }), null);
    assert.equal(parseSupportThread({ supportCase: { ...supportCase, id: anotherId }, messages: [] }, caseId), null);
    assert.equal(parseSupportThread({ supportCase, messages: [{ ...message, caseId: anotherId }] }, caseId), null);
    assert.equal(parseSupportThread({ supportCase, messages: [{ ...message, createdAt: "not-a-date" }] }, caseId), null);
    assert.equal(parseSupportThread({ supportCase, messages: [{ ...message, body: "X".repeat(4001) }] }, caseId), null);
  });

  it("only confirms a created ticket after HTTP 201 and exact category, subject and id", () => {
    const input = { category: "account", subject: " Account access " };
    assert.deepEqual(confirmSupportCaseCreated(201, { success: true, supportCase }, input), supportCase);
    assert.equal(confirmSupportCaseCreated(200, { success: true, supportCase }, input), null);
    assert.equal(confirmSupportCaseCreated(201, { success: true, supportCase: { ...supportCase, id: anotherId, status: "closed" } }, input), null);
    assert.equal(confirmSupportCaseCreated(201, { success: true, supportCase: { ...supportCase, subject: "Other ticket" } }, input), null);
    assert.equal(confirmSupportCaseCreated(201, { success: true, supportCase: { ...supportCase, category: "other" } }, input), null);
    assert.equal(confirmSupportCaseCreated(201, { success: true }, input), null);
  });

  it("only confirms a reply with the committed message identity, case and text", () => {
    const payload = { success: true, supportCase, message };
    assert.deepEqual(confirmSupportReply(201, payload, caseId, " " + message.body + " "), {
      supportCase: { id: caseId, category: "account", subject: "Account access", status: "open" },
      message,
    });
    assert.equal(confirmSupportReply(200, payload, caseId, message.body), null);
    assert.equal(confirmSupportReply(201, { success: true }, caseId, message.body), null);
    assert.equal(confirmSupportReply(201, { ...payload, message: { ...message, body: "Other reply" } }, caseId, message.body), null);
    assert.equal(confirmSupportReply(201, { ...payload, message: { ...message, caseId: anotherId } }, caseId, message.body), null);
    assert.equal(confirmSupportReply(201, { ...payload, supportCase: { ...supportCase, status: "closed" } }, caseId, message.body), null);
  });

  it("rejects mismatched or unconfirmed moderation transitions", () => {
    const resolved = { ...supportCase, status: "resolved" };
    const payload = { success: true, supportCase: resolved };
    assert.deepEqual(confirmSupportStatusChanged(200, payload, caseId, "resolved"), {
      id: caseId, category: "account", subject: "Account access", status: "resolved",
    });
    assert.equal(confirmSupportStatusChanged(201, payload, caseId, "resolved"), null);
    assert.equal(confirmSupportStatusChanged(200, payload, caseId, "closed"), null);
    assert.equal(confirmSupportStatusChanged(200, payload, anotherId, "resolved"), null);
    assert.equal(confirmSupportStatusChanged(200, { ...payload, success: false }, caseId, "resolved"), null);
  });
});
