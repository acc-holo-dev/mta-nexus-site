import { describe, expect, it } from "vitest";
import {
  audit,
  fixture,
  setupOrganizationGovernancePersistence,
  teams,
  transfer,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: takeover denial", () => {
  it("denies administrator takeover and rejects a removed recipient or changed team revision", async () => {
    const f = await fixture("admin");
    await expect(
      transfer(f, { actorId: f.target.id, targetId: f.owner.id, targetUsername: f.owner.username }),
    ).rejects.toMatchObject({ code: "OWNERSHIP_OWNER_REQUIRED" });
    await teams.changeMember(
      f.org.id,
      f.owner.id,
      f.org.updatedAt,
      f.target.id,
      null,
      audit(f.owner, f.org.id, "organization.member_removed"),
      f.currentToken,
    );
    await expect(transfer(f)).rejects.toMatchObject({ code: "CONFLICT" });
    const fresh = (await teams.getWorkspace(f.org.id, f.owner.id)).organization;
    await expect(transfer({ ...f, org: fresh })).rejects.toMatchObject({
      code: "OWNERSHIP_TARGET_INVALID",
    });
    expect(fresh.ownerId).toBe(f.owner.id);
  });
});
