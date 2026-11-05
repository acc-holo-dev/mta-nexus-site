import { describe, expect, it } from "vitest";
import {
  fixture,
  governance,
  setupOrganizationGovernancePersistence,
  teams,
  transfer,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: concurrent transfer", () => {
  it("serializes competing transfers and grants the retained administrator role explicitly", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      transfer(f, { formerOwnerRole: "admin" }),
      transfer(f, { formerOwnerRole: "admin" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await teams.getWorkspace(f.org.id, f.owner.id)).role).toBe("admin");
    expect(
      (await governance.history(f.org.id, f.owner.id)).items.filter(
        (item) => item.action === "organization.ownership_transferred",
      ),
    ).toHaveLength(1);
  });
});
