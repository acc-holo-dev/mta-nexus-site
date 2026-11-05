import { describe, expect, it } from "vitest";
import {
  and,
  db,
  eq,
  fixture,
  organizationMembers,
  organizations,
  setupOrganizationGovernancePersistence,
  teams,
  transfer,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: legacy repair", () => {
  it("repairs a missing legacy owner membership while preserving the verified organization identity", async () => {
    const f = await fixture();
    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, f.org.id),
          eq(organizationMembers.userId, f.owner.id),
        ),
      );
    await db.update(organizations).set({ isVerified: true }).where(eq(organizations.id, f.org.id));
    await transfer(f);
    const stored = await teams.getWorkspace(f.org.id, f.owner.id);
    expect(stored.role).toBe("member");
    expect(stored.organization.isVerified).toBe(true);
  });
});
