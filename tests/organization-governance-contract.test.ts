import { expect, it } from "vitest";
import { formatNotification } from "../site/src/lib/notification-copy";
import {
  organizationHistoryCursor,
  organizationHistorySchema,
  ownershipTransferSchema,
} from "../site/src/lib/organization-governance-contract";
import {
  organizationGovernanceCopy,
  organizationGovernanceError,
  organizationGovernanceMutationError,
} from "../site/src/lib/organization-governance-copy";

const transfer = {
  targetId: "target",
  targetUsername: " target ",
  confirmationSlug: "team",
  currentPassword: "Current-password-123!",
  formerOwnerRole: "member",
  expectedUpdatedAt: "2026-10-11T00:00:00.000Z",
};
it("requires explicit recipient identity, retained role, confirmation, password and shared revision", () => {
  expect(ownershipTransferSchema.parse(transfer).targetUsername).toBe("target");
  for (const extra of [
    { targetId: "a/b" },
    { formerOwnerRole: "owner" },
    { expectedUpdatedAt: "yesterday" },
    { confirmationSlug: "" },
    { currentPassword: "" },
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
    ] as const) {
      const legacy = formatNotification(
        {
          title: "Organization access changed",
          message: `Organization org_1: ${action}.`,
          data: null,
        },
        { approved: "", rejected: "", notes: "", version: "" },
        locale,
      );
      expect(legacy.message).not.toContain("Organization org_1:");
      expect(legacy.message).not.toContain("org_1");
      expect(legacy.message.length).toBeGreaterThan(5);
      const structured = formatNotification(
        {
          title: "Organization access changed",
          message: "stored",
          data: {
            kind: "organization_access",
            event: action,
            organizationId: "org_1",
            organizationName: "Northwind",
            organizationSlug: "northwind",
          },
        },
        { approved: "", rejected: "", notes: "", version: "" },
        locale,
      );
      expect(structured.message).toContain("Northwind");
      expect(structured.message).not.toContain("org_1");
      expect(structured.title.toLowerCase()).toContain(
        locale === "ru" ? "организац" : "organization",
      );
    }
  },
);
