import { describe, expect, it } from "vitest";
import {
  actor,
  and,
  audit,
  auditEvents,
  db,
  eq,
  fixture,
  notifications,
  setupOrganizationGovernancePersistence,
  teams,
  transfer,
} from "../helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: audit rollback", () => {
  it("rolls back owner, roles and notices on an audit failure", async () => {
    const f = await fixture();
    const badActor = await actor();
    const duplicate = audit(badActor, f.org.id, "fixture");
    await db.insert(auditEvents).values(duplicate);
    await expect(transfer(f, { auditId: duplicate.id })).rejects.toBeDefined();
    const stored = await teams.getWorkspace(f.org.id, f.owner.id);
    expect(stored.role).toBe("owner");
    expect(stored.organization.ownerId).toBe(f.owner.id);
    expect(
      await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientId, f.target.id),
            eq(
              notifications.message,
              `Organization ownership was transferred to you. (${f.org.name})`,
            ),
          ),
        ),
    ).toHaveLength(0);
  });
});
