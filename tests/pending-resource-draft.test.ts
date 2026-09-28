import { describe, expect, it } from "vitest";
import { parsePendingResourceDraft } from "../apps/web/src/lib/pending-resource-draft";

describe("pending resource draft recovery", () => {
  it("restores only the minimal valid retry identity", () => {
    expect(
      parsePendingResourceDraft(
        JSON.stringify({
          id: "prd_saved_draft_1",
          slug: "saved-resource",
          mtaVersionTarget: "1.6.0",
          title: "ignored client-only metadata",
        }),
      ),
    ).toEqual({
      id: "prd_saved_draft_1",
      slug: "saved-resource",
      mtaVersionTarget: "1.6.0",
    });
  });

  it.each([
    null,
    "",
    "not-json",
    JSON.stringify({ id: "x", slug: "saved-resource", mtaVersionTarget: "1.6.0" }),
    JSON.stringify({ id: "prd_valid", slug: "Invalid Slug", mtaVersionTarget: "1.6.0" }),
    JSON.stringify({ id: "prd_valid", slug: "saved-resource", mtaVersionTarget: "x".repeat(65) }),
  ])("discards invalid or stale storage payloads", (payload) => {
    expect(parsePendingResourceDraft(payload)).toBeNull();
  });
});
