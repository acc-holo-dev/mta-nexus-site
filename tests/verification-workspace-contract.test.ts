import { expect, it } from "vitest";
import {
  developerProfileUpdateSchema,
  parseVerificationQuery,
  verificationApplicationSchema,
  verificationDecisionSchema,
} from "../apps/web/src/lib/verification-workspace-contract";
import {
  verificationCopy,
  verificationError,
  verificationMutationError,
  verificationDecisionError,
} from "../apps/web/src/lib/verification-workspace-copy";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
const profile = {
  specialties: [" Lua ", "Lua", "TypeScript"],
  githubUrl: "https://github.com/example",
  discordTag: " developer ",
  expectedUpdatedAt: "2026-10-10T00:00:00.000Z",
};
const application = {
  targetType: "developer",
  targetId: "usr_dev",
  proofUrl: "https://example.test/evidence",
  notes: " My project evidence ",
};
it("normalizes professional fields and rejects forged trust/counter/identity updates", () => {
  expect(developerProfileUpdateSchema.parse(profile)).toMatchObject({
    specialties: ["Lua", "TypeScript"],
    discordTag: "developer",
  });
  for (const extra of [
    { verifiedDeveloper: true },
    { reputationScore: 999 },
    { completedDealsCount: 5 },
    { actorId: "victim" },
  ])
    expect(developerProfileUpdateSchema.safeParse({ ...profile, ...extra }).success).toBe(false);
  expect(
    developerProfileUpdateSchema.safeParse({ ...profile, expectedUpdatedAt: "yesterday" }).success,
  ).toBe(false);
  expect(
    developerProfileUpdateSchema.safeParse({ ...profile, specialties: Array(13).fill("Lua") })
      .success,
  ).toBe(false);
  expect(
    developerProfileUpdateSchema.safeParse({ ...profile, discordTag: "bad\u0000value" }).success,
  ).toBe(false);
});
it.each([
  "javascript:alert(1)",
  "data:text/html,test",
  "https://user:password@example.test",
  "https://example.test/ bad",
])("rejects unsafe profile/evidence links %s", (url) => {
  expect(developerProfileUpdateSchema.safeParse({ ...profile, githubUrl: url }).success).toBe(
    false,
  );
  expect(verificationApplicationSchema.safeParse({ ...application, proofUrl: url }).success).toBe(
    false,
  );
});
it("requires evidence and meaningful notes; protects MTA control flow and review fields", () => {
  expect(verificationApplicationSchema.parse(application).notes).toBe("My project evidence");
  for (const extra of [
    { proofUrl: "" },
    { notes: "short" },
    { targetType: "server" },
    { status: "approved" },
    { requesterId: "victim" },
  ])
    expect(verificationApplicationSchema.safeParse({ ...application, ...extra }).success).toBe(
      false,
    );
  expect(
    verificationDecisionSchema.safeParse({
      decision: "approved",
      reviewNotes: "Reviewed",
      reviewerId: "admin",
    }).success,
  ).toBe(false);
  expect(
    verificationDecisionSchema.safeParse({ decision: "approved", reviewNotes: " " }).success,
  ).toBe(false);
});
it("bounds catalog/history filters, rejects duplicates and actor-scope injection", () => {
  expect(parseVerificationQuery(new URLSearchParams("view=history&type=developer&page=2"))).toEqual(
    { view: "history", type: "developer", page: 2, query: "" },
  );
  expect(parseVerificationQuery(new URLSearchParams("q=Team&page=2"), true)).toMatchObject({
    query: "Team",
    page: 2,
  });
  for (const query of [
    "page=0",
    "page=10000",
    "page=1&page=2",
    "requesterId=victim",
    "view=all",
    "type=product",
    "q=team",
  ])
    expect(parseVerificationQuery(new URLSearchParams(query))).toBeNull();
  expect(parseVerificationQuery(new URLSearchParams({ q: "x".repeat(101) }), true)).toBeNull();
});
it.each(["ru", "en"] as const)(
  "localizes experience, stale-data and uncertain-write outcomes in %s",
  (locale) => {
    const copy = verificationCopy(locale);
    for (const value of Object.values(copy)) expect(value.trim().length).toBeGreaterThan(0);
    expect(copy.user).not.toBe(copy.developer);
    expect(verificationError(locale, "VERIFICATION_PROFILE_CHANGED")).toBe(copy.profileChanged);
    expect(verificationMutationError(locale, "INTERNAL_ERROR")).toBe(copy.mutationUnavailable);
    expect(verificationDecisionError(locale, "INTERNAL_ERROR")).toBe(copy.decisionUnavailable);
    expect(
      formatNotification(
        {
          title: "Verification approved",
          message: "developer verification for usr_dev was approved.",
          data: null,
        },
        { approved: "", rejected: "", version: "", notes: "" },
        locale,
      ).title,
    ).toBe(locale === "ru" ? "Верификация одобрена" : "Verification approved");
  },
);
