import { describe, expect, it } from "vitest";
import {
  auditEvents,
  db,
  fixture,
  governance,
  randomUUID,
  setupOrganizationGovernancePersistence,
  sql,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: history pagination", () => {
  it("paginates tied microsecond events exactly once and hides raw or unrelated audit details", async () => {
    const f = await fixture();
    const events = Array.from({ length: 43 }, (_, index) => ({
      id: `aud_ogov_${randomUUID()}_${String(index).padStart(2, "0")}`,
      actorId: f.owner.id,
      actorType: "user" as const,
      targetId: f.org.id,
      targetType: "organization",
      action: "organization.profile_updated",
      details: {
        fields: ["name", "ownerId", "private-token"],
        password: "PRIVATE",
        permissions: ["manage_products"],
      },
      ipAddress: "PRIVATE",
      userAgent: "PRIVATE",
      createdAt: sql`'2026-10-11T00:00:00.123456Z'::timestamptz`,
    }));
    await db.insert(auditEvents).values(events);
    const ids: string[] = [];
    let before: string | undefined;
    for (let page = 0; page < 4; page++) {
      const result = await governance.history(f.org.id, f.owner.id, before);
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE|manage_products|private-token/u);
      ids.push(...result.items.map((item) => item.id));
      if (!result.hasMore) break;
      before = result.nextCursor ?? undefined;
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => events.some((event) => event.id === id))).toHaveLength(43);
    const foreign = await fixture();
    await expect(
      governance.history(
        f.org.id,
        f.owner.id,
        (await governance.history(foreign.org.id, foreign.owner.id)).items[0].id,
      ),
    ).rejects.toMatchObject({ code: "ORGANIZATION_HISTORY_EXPIRED" });
  });
});
