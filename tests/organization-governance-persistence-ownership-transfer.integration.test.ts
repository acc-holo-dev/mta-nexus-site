import { describe, expect, it } from "vitest";
import {
  and,
  db,
  eq,
  fixture,
  governance,
  inArray,
  notifications,
  organizationMembers,
  setupOrganizationGovernancePersistence,
  teams,
  transfer,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: ownership transfer", () => {
  it("persists one authoritative owner, both chosen roles, unchanged permissions and two transactional inbox notices", async () => {
    const f = await fixture();
    await db
      .update(organizationMembers)
      .set({ permissions: ["manage_products", "manage_servers", "custom"] })
      .where(eq(organizationMembers.organizationId, f.org.id));
    await transfer(f);
    const stored = await teams.getWorkspace(f.org.id, f.owner.id);
    expect(stored.role).toBe("member");
    expect(stored.organization.ownerId).toBe(f.target.id);
    expect(stored.owner?.id).toBe(f.target.id);
    const members = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, f.org.id));
    expect(members.find((member) => member.userId === f.target.id)).toMatchObject({
      role: "owner",
      permissions: ["manage_products", "manage_servers", "custom"],
    });
    expect(members.find((member) => member.userId === f.owner.id)).toMatchObject({
      role: "member",
      permissions: ["manage_products", "manage_servers", "custom"],
    });
    await expect(governance.history(f.org.id, f.owner.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(transfer(f)).rejects.toMatchObject({
      code: "OWNERSHIP_OWNER_REQUIRED",
    });
    expect((await teams.getWorkspace(f.org.id, f.owner.id)).organization.ownerId).toBe(f.target.id);
    expect((await governance.history(f.org.id, f.target.id)).items[0].action).toBe(
      "organization.ownership_transferred",
    );
    const notices = await db
      .select()
      .from(notifications)
      .where(
        and(
          inArray(notifications.recipientId, [f.owner.id, f.target.id]),
          eq(notifications.title, "Organization access changed"),
        ),
      );
    expect(notices.map((notice) => notice.message)).toEqual(
      expect.arrayContaining([
        `Organization ${f.org.id}: ownership_gained.`,
        `Organization ${f.org.id}: ownership_transferred.`,
      ]),
    );
  });
});
