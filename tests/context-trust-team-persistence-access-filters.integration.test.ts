import { describe, expect, it } from "vitest";
import {
  actor,
  audit,
  db,
  directory,
  eq,
  management,
  member,
  notifications,
  organization,
  organizationMembers,
  setupContextTrustTeamPersistence,
} from "./helpers/context-trust-team-persistence-harness";

setupContextTrustTeamPersistence();

describe("context trust team persistence: access filters", () => {
  it("filters effective admin/delegated access and reflects existing role commands while preserving unrelated permissions", async () => {
    const owner = await actor(),
      org = await organization(owner.id),
      admin = await actor(),
      developer = await actor(),
      reader = await actor(),
      legacy = await actor();
    await member(org.id, admin.id, "admin");
    await member(org.id, developer.id, "developer", ["manage_servers"]);
    const target = await member(org.id, reader.id, "member", ["manage_products", "custom"]);
    await member(org.id, legacy.id, "owner", ["manage_servers"]);
    expect(
      (await directory.page(org.id, owner.id, { query: "", access: "yes" })).members
        .map((row) => row.id)
        .sort(),
    ).toEqual([admin.id, developer.id].sort());
    expect(
      (
        await directory.page(org.id, owner.id, { query: "", role: "other", access: "no" })
      ).members.map((row) => row.id),
    ).toEqual([legacy.id]);
    const saved = await management.changeMember(
      org.id,
      owner.id,
      org.updatedAt,
      reader.id,
      { role: "developer", managesServers: true },
      audit(owner.id, org.id),
      `org-test-${owner.id}`,
    );
    expect(
      (
        await directory.page(org.id, reader.id, {
          query: reader.username,
          role: "developer",
          access: "yes",
        })
      ).members[0],
    ).toMatchObject({
      id: reader.id,
      role: "developer",
      managesServers: true,
      effectiveServerAccess: true,
    });
    const [stored] = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.id, target.id));
    expect(stored.permissions).toEqual(
      expect.arrayContaining(["manage_products", "custom", "manage_servers"]),
    );
    await expect(
      management.changeMember(
        org.id,
        reader.id,
        saved.organization.updatedAt,
        admin.id,
        null,
        audit(reader.id, org.id),
        `org-test-${reader.id}`,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      management.changeMember(
        org.id,
        owner.id,
        org.updatedAt,
        reader.id,
        null,
        audit(owner.id, org.id),
        `org-test-${owner.id}`,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const notice = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, reader.id));
    expect(
      notice.some(
        (row) =>
          row.message === `Your role or delegated access changed. (${org.name})` ||
          (row.data &&
            typeof row.data === "object" &&
            "kind" in row.data &&
            row.data.kind === "organization_access" &&
            "event" in row.data &&
            row.data.event === "updated"),
      ),
    ).toBe(true);
  });
});
