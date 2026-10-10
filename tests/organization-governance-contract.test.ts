import { expect, it } from "vitest";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
import {
  organizationHistoryCursor,
  organizationHistorySchema,
  ownershipTransferSchema,
} from "../apps/web/src/lib/organization-governance-contract";
import {
  organizationGovernanceCopy,
  organizationGovernanceError,
  organizationGovernanceMutationError,
} from "../apps/web/src/lib/organization-governance-copy";

const transfer = {
  targetId: "target",
  targetUsername: " target ",
  confirmationSlug: "team",
  formerOwnerRole: "member",
  expectedUpdatedAt: "2026-10-11T00:00:00.000Z",
};
it("requires explicit recipient identity, retained role, confirmation and shared revision", () => {
  expect(ownershipTransferSchema.parse(transfer).targetUsername).toBe("target");
  for (const extra of [
    { targetId: "a/b" },
    { formerOwnerRole: "owner" },
    { expectedUpdatedAt: "yesterday" },
    { confirmationSlug: "" },
    { actorId: "owner" },
    { permissions: ["manage_products"] },
    { isVerified: true },
    { targetUsername: "@target" },
  ])
    expect(ownershipTransferSchema.safeParse({ ...transfer, ...extra }).success).toBe(false);
});
it("limits private history to one opaque anchor without actor, scope or size injection", () => {
  expect(organizationHistoryCursor(new URLSearchParams())).toEqual({ before: undefined });
  expect(organizationHistoryCursor(new URLSearchParams("before=audit_1"))).toEqual({
    before: "audit_1",
  });
  for (const query of [
    "before=a&before=b",
    "before=bad%2Fid",
    "actorId=owner",
    "targetId=other",
    "limit=1000",
    `before=${"x".repeat(129)}`,
  ])
    expect(organizationHistoryCursor(new URLSearchParams(query))).toBeNull();
  expect(
    organizationHistorySchema.safeParse({
      organization: { id: "org", name: "Team", slug: "team" },
      items: [],
      hasMore: false,
      nextCursor: null,
    }).success,
  ).toBe(true);
});
it.each(["ru", "en"] as const)(
  "localizes governance states and private access notices in %s",
  (locale) => {
    const copy = organizationGovernanceCopy(locale);
    expect(organizationGovernanceError(locale, "OWNERSHIP_TARGET_INVALID")).toBe(
      copy.targetInvalid,
    );
    expect(organizationGovernanceError(locale, "ORGANIZATION_HISTORY_EXPIRED")).toBe(copy.expired);
    expect(organizationGovernanceMutationError(locale, "INTERNAL_ERROR")).toBe(
      copy.mutationUnavailable,
    );
    for (const action of [
      "added",
      "updated",
      "removed",
      "left",
      "ownership_gained",
      "ownership_transferred",
    ]) {
      const notice = formatNotification(
        {
          title: "Organization access changed",
          message: `Organization org_1: ${action}.`,
          data: null,
        },
        { approved: "", rejected: "", notes: "", version: "" },
        locale,
      );
      expect(notice.message).not.toContain("Organization org_1:");
      expect(notice.message.length).toBeGreaterThan(5);
    }
  },
);
