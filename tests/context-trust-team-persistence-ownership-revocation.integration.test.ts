import { describe, expect, it } from "vitest";
import {
  actor,
  and,
  audit,
  auditEvents,
  db,
  directory,
  eq,
  management,
  member,
  organization,
  organizationMembers,
  organizations,
  setupContextTrustTeamPersistence,
} from "./helpers/context-trust-team-persistence-harness";

setupContextTrustTeamPersistence();

describe("context trust team persistence: ownership revocation", () => {
  it("honors current ownership and membership revocation and retains the prior directory state when a mandatory write fails", async () => {
    const owner = await actor(),
      next = await actor(),
      outsider = await actor("admin"),
      org = await organization(owner.id);
    await member(org.id, next.id);
    await member(org.id, owner.id, "owner");
    await expect(directory.page(org.id, outsider.id, { query: "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const duplicate = audit(owner.id, org.id);
    await db.insert(auditEvents).values(duplicate);
    await expect(
      management.changeMember(
        org.id,
        owner.id,
        org.updatedAt,
        next.id,
        { role: "admin", managesServers: true },
        duplicate,
        `org-test-${owner.id}`,
      ),
    ).rejects.toThrow();
    expect(
      (await directory.page(org.id, owner.id, { query: next.username })).members[0],
    ).toMatchObject({ role: "member", managesServers: false, effectiveServerAccess: false });
    await db.update(organizations).set({ ownerId: next.id }).where(eq(organizations.id, org.id));
    await expect(directory.page(org.id, owner.id, { query: "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const current = await directory.page(org.id, next.id, { query: "" });
    expect(current.role).toBe("owner");
    expect(current.owner?.id).toBe(next.id);
    expect(current.members.map((row) => row.id)).not.toContain(next.id);
    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.userId, owner.id),
        ),
      );
    await expect(directory.page(org.id, owner.id, { query: "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
