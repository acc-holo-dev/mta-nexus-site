import { describe, expect, it } from "vitest";
import {
  createPendingResourceDraft,
  PENDING_RESOURCE_DRAFT_TTL_MS,
  parsePendingResourceDraft,
  pendingResourceDraftKey,
} from "../apps/web/src/lib/pending-resource-draft";

const now = Date.UTC(2026, 9, 5);
const draft = { id: "prd_saved_draft_1", slug: "saved-resource", mtaVersionTarget: "1.6.0" };
const value = createPendingResourceDraft(draft, "author", now);
describe("pending resource recovery", () => {
  it("restores only the current author's minimal retry identity", () => {
    expect(
      parsePendingResourceDraft(
        JSON.stringify({ ...value, title: "ignored", file: "ignored" }),
        "author",
        now,
      ),
    ).toEqual(draft);
    expect(parsePendingResourceDraft(JSON.stringify(value), "other-author", now)).toBeNull();
    expect(pendingResourceDraftKey("a:b")).not.toBe(pendingResourceDraftKey("a%3Ab"));
  });
  it.each([
    null,
    "",
    "not-json",
    JSON.stringify(draft),
    JSON.stringify({ ...value, schemaVersion: 1 }),
    JSON.stringify({ ...value, id: "x" }),
    JSON.stringify({ ...value, slug: "Invalid Slug" }),
    JSON.stringify({ ...value, mtaVersionTarget: "invalid" }),
    JSON.stringify({ ...value, savedAt: now + 1 }),
    JSON.stringify({ ...value, savedAt: now - PENDING_RESOURCE_DRAFT_TTL_MS }),
  ])("discards invalid, unscoped or expired storage payloads %#", (payload) => {
    expect(parsePendingResourceDraft(payload, "author", now)).toBeNull();
  });
  it("keeps an optional minimum version and accepts a record just before expiry", () => {
    expect(
      parsePendingResourceDraft(
        JSON.stringify({
          ...value,
          mtaVersionTarget: "",
          savedAt: now - PENDING_RESOURCE_DRAFT_TTL_MS + 1,
        }),
        "author",
        now,
      ),
    ).toEqual({ ...draft, mtaVersionTarget: "" });
  });
});
