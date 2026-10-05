import { describe, expect, it } from "vitest";
import {
  AUTHOR_RESOURCE_DRAFT_TTL_MS, authorResourceDraftKey, emptyAuthorVersion,
  hasAuthorVersionDraft, parseAuthorResourceDraft, sameAuthorDetails, reconcileAuthorDetails,
} from "../apps/web/src/lib/author-resource-draft";

const now = Date.parse("2026-10-05T00:00:00Z");
const scope = { actorId: "usr_author", productId: "prd_resource" };
const draft = {
  schemaVersion: 1, ...scope, savedAt: now - 1000,
  baseUpdatedAt: "2026-10-04T00:00:00.000Z",
  details: { title: "", shortDescription: "", description: "unfinished", tagsText: "partial," },
  version: { version: "1.", mtaVersionTarget: "", releaseNotes: "Work in progress" },
};

describe("author resource text recovery", () => {
  it("recovers incomplete text and strips unknown fields, including file data", () => {
    expect(parseAuthorResourceDraft(JSON.stringify({ ...draft, file: "bytes", details: { ...draft.details, file: "secret" } }), scope, now)).toEqual(draft);
  });
  it("uses distinct scope keys even when identities contain separators", () => {
    expect(authorResourceDraftKey("a:b", "c")).not.toBe(authorResourceDraftKey("a", "b:c"));
    expect(authorResourceDraftKey("author", "resource")).not.toBe(authorResourceDraftKey("other", "resource"));
    expect(authorResourceDraftKey("author", "resource")).not.toBe(authorResourceDraftKey("author", "other"));
  });
  it.each([
    { ...draft, actorId: "usr_other" }, { ...draft, productId: "prd_other" },
    { ...draft, schemaVersion: 2 }, { ...draft, savedAt: now + 1 },
    { ...draft, savedAt: now - AUTHOR_RESOURCE_DRAFT_TTL_MS },
    { ...draft, savedAt: "yesterday" }, { ...draft, baseUpdatedAt: "invalid" },
    { ...draft, details: null }, { ...draft, version: [] },
    { ...draft, details: { ...draft.details, description: "x".repeat(10_001) } },
    { ...draft, details: { ...draft.details, tagsText: "x".repeat(4097) } },
    { ...draft, version: { ...draft.version, version: "x".repeat(65) } },
    { ...draft, version: { ...draft.version, releaseNotes: "x".repeat(5001) } },
  ])("rejects a malformed, expired or unrelated draft %#", (value) => {
    expect(parseAuthorResourceDraft(JSON.stringify(value), scope, now)).toBeNull();
  });
  it.each([null, "", "invalid-json", "null", "[]", "x".repeat(100_001)])("rejects invalid raw storage %#", (raw) => {
    expect(parseAuthorResourceDraft(raw, scope, now)).toBeNull();
  });
  it("keeps a draft until its exact TTL boundary", () => {
    expect(parseAuthorResourceDraft(JSON.stringify({ ...draft, savedAt: now - AUTHOR_RESOURCE_DRAFT_TTL_MS + 1 }), scope, now)).not.toBeNull();
  });
  it("detects independent pending details and version text", () => {
    expect(sameAuthorDetails(draft.details, { ...draft.details })).toBe(true);
    expect(sameAuthorDetails(draft.details, { ...draft.details, title: "changed" })).toBe(false);
    expect(hasAuthorVersionDraft(emptyAuthorVersion)).toBe(false);
    expect(hasAuthorVersionDraft({ ...emptyAuthorVersion, releaseNotes: "unfinished" })).toBe(true);
  });
});


describe("refreshed author metadata", () => {
  const oldDetails = { title: "Previous title", shortDescription: "Old summary", description: "Old description", tagsText: "lua" };
  const newDetails = { ...oldDetails, title: "Other author's new title" };
  const previousTimestamp = "2026-10-04T00:00:00.000Z";
  const newTimestamp = "2026-10-05T00:00:00.000Z";
  it("updates a clean editor to the externally changed metadata", () => {
    const result = reconcileAuthorDetails({ baseline: oldDetails, details: oldDetails, baseUpdatedAt: previousTimestamp },
      { details: newDetails, updatedAt: newTimestamp });
    expect(result.details).toEqual(newDetails);
    expect(result.baseline).toEqual(newDetails);
    expect(result.baseUpdatedAt).toBe(newTimestamp);
    expect(result.needsChoice).toBe(false);
    expect(sameAuthorDetails(result.details, result.baseline)).toBe(true);
  });
  it("retains pending user text while requiring an explicit conflict choice", () => {
    const pending = { ...oldDetails, description: "My unsaved description" };
    const result = reconcileAuthorDetails({ baseline: oldDetails, details: pending, baseUpdatedAt: previousTimestamp },
      { details: newDetails, updatedAt: newTimestamp });
    expect(result.details).toEqual(pending);
    expect(result.baseline).toEqual(newDetails);
    expect(result.needsChoice).toBe(true);
    expect(sameAuthorDetails(result.details, result.baseline)).toBe(false);
  });
  it("advances after an upload without disturbing pending metadata", () => {
    const pending = { ...oldDetails, description: "My unsaved description" };
    const result = reconcileAuthorDetails({ baseline: oldDetails, details: pending, baseUpdatedAt: previousTimestamp },
      { details: oldDetails, updatedAt: newTimestamp });
    expect(result.details).toEqual(pending);
    expect(result.baseline).toEqual(oldDetails);
    expect(result.baseUpdatedAt).toBe(newTimestamp);
    expect(result.needsChoice).toBe(false);
  });
  it("does not regress a confirmed save when old props are still rendering", () => {
    const result = reconcileAuthorDetails({ baseline: newDetails, details: newDetails, baseUpdatedAt: newTimestamp },
      { details: oldDetails, updatedAt: previousTimestamp });
    expect(result.details).toEqual(newDetails);
    expect(result.baseline).toEqual(newDetails);
    expect(result.baseUpdatedAt).toBe(newTimestamp);
    expect(result.changed).toBe(false);
  });
});
