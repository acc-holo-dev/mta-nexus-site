import { expect, it } from "vitest";
import { serverClaimMatchesOwnershipScope } from "@nexus/domain";

it.each([
  [true, null, null, true],
  [true, "org_a", "org_a", true],
  [true, "org_a", "org_b", false],
  [true, "org_a", null, false],
  [true, null, "org_a", false],
  [false, null, null, false],
  [false, "org_a", "org_a", false],
] as const)(
  "matches only explicitly recorded current scope: %s %s %s",
  (recorded, before, current, expected) => {
    expect(
      serverClaimMatchesOwnershipScope(
        { claimScopeRecorded: recorded, claimOrganizationId: before },
        { organizationId: current },
      ),
    ).toBe(expected);
  },
);
