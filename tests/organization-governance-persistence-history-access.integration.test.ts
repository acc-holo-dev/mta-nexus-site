import { describe, expect, it } from "vitest";
import {
  and,
  audit,
  db,
  eq,
  fixture,
  governance,
  notifications,
  setupOrganizationGovernancePersistence,
  teams,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: history access", () => {
  it("rejects history after administrator access is revoked and keeps removed-access notices public-link safe", async () => {
    const f = await fixture("admin");
    expect((await governance.history(f.org.id, f.target.id)).items.length).toBeGreaterThan(0);
    await teams.changeMember(
      f.org.id,
      f.owner.id,
      f.org.updatedAt,
      f.target.id,
      null,
      audit(f.owner, f.org.id, "organization.member_removed"),
      f.currentToken,
    );
    await expect(governance.history(f.org.id, f.target.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const [notice] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, f.target.id),
          eq(notifications.message, `Organization ${f.org.id}: removed.`),
        ),
      );
    expect(notice.link).toBe(`/organizations/${f.org.slug}`);
  });
});
