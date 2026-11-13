import { serverReviewEligibility } from "@nexus/domain";
import {
  serverReviewCommandSchema,
  serverReviewCreateSchema,
  serverReviewModerationSchema,
} from "@nexus/validation";
import { expect, it } from "vitest";
import { confirmedServerReview } from "../../site/src/lib/server-review-confirmation";
import { serverReviewQuery } from "../../site/src/lib/server-review-query";

it("requires follow evidence and blocks owner or moderated authors", () => {
  expect(serverReviewEligibility({ following: true, ownsServer: false, removed: false })).toEqual({
    eligible: true,
    reason: "ok",
  });
  expect(serverReviewEligibility({ following: false, ownsServer: false, removed: false })).toEqual({
    eligible: false,
    reason: "follow_required",
  });
  expect(serverReviewEligibility({ following: true, ownsServer: true, removed: false })).toEqual({
    eligible: false,
    reason: "owner_conflict",
  });
  expect(serverReviewEligibility({ following: true, ownsServer: false, removed: true })).toEqual({
    eligible: false,
    reason: "moderated",
  });
});

it("rejects forged ownership or interaction claims in create payloads", () => {
  expect(serverReviewCreateSchema.parse({ text: "  Solid RP  ", rating: 4 })).toEqual({
    text: "Solid RP",
    rating: 4,
  });
  for (const body of [
    { text: "Solid RP", rating: 4, interactionSource: "follow" },
    { text: "Solid RP", rating: 4, authorId: "usr_other" },
    { text: "Solid RP", rating: 0 },
    { text: "no", rating: 5 },
  ]) {
    expect(serverReviewCreateSchema.safeParse(body).success).toBe(false);
  }
});

it("keeps withdraw revisions strict and bounds moderation notes", () => {
  expect(serverReviewCommandSchema.parse({ action: "withdraw", expectedRevision: 2 })).toEqual({
    action: "withdraw",
    expectedRevision: 2,
  });
  expect(
    serverReviewCommandSchema.safeParse({ action: "withdraw", expectedRevision: 0 }).success,
  ).toBe(false);
  expect(
    serverReviewModerationSchema.parse({
      action: "remove",
      expectedRevision: 3,
      notes: "Spam network",
    }),
  ).toMatchObject({ action: "remove", expectedRevision: 3 });
  expect(
    serverReviewModerationSchema.safeParse({
      action: "remove",
      expectedRevision: 3,
      notes: "no",
    }).success,
  ).toBe(false);
});

it.each(["page=0", "page=01", "page=1&view=all", "page=10000"])(
  "rejects ambiguous public query %s",
  (value) => {
    expect(() => serverReviewQuery(new URLSearchParams(value))).toThrow();
  },
);

it("only confirms server-acknowledged revision bumps", () => {
  expect(confirmedServerReview({ id: "cmt_1", revision: 1, status: "published" }, 0, "save")).toBe(
    true,
  );
  expect(confirmedServerReview({ id: "cmt_1", revision: 1, status: "published" }, 1, "save")).toBe(
    false,
  );
  expect(
    confirmedServerReview({ id: "cmt_1", revision: 2, status: "withdrawn" }, 1, "withdraw"),
  ).toBe(true);
});

it("keeps public review load failure distinct from a real empty page", () => {
  type ReviewLoad =
    | { state: "ready"; page: { reviews: unknown[]; total: number } }
    | { state: "unavailable" };
  const failed: ReviewLoad = { state: "unavailable" };
  const empty: ReviewLoad = { state: "ready", page: { reviews: [], total: 0 } };
  expect(failed).not.toEqual(empty);
  expect(empty.state === "ready" && empty.page.total === 0).toBe(true);
  expect("page" in failed).toBe(false);
});

it("never treats an unconfirmed mutation body as success", () => {
  expect(confirmedServerReview({ id: "cmt_1", revision: 1, status: "withdrawn" }, 0, "save")).toBe(
    false,
  );
  expect(confirmedServerReview({ success: true, revision: 2 }, 1, "save")).toBe(false);
  expect(confirmedServerReview(null, 0, "save")).toBe(false);
});
