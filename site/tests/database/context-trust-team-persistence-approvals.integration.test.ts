import { describe, expect, it } from "vitest";
import {
  actor,
  createHash,
  db,
  eq,
  organization,
  organizations,
  randomUUID,
  server,
  setupContextTrustTeamPersistence,
  sql,
  time,
  trust,
  verificationRequests,
} from "../helpers/context-trust-team-persistence-harness";

setupContextTrustTeamPersistence();

describe("context trust team persistence: approval cursors", () => {
  it("traverses tied microsecond context approvals exactly once and binds cursors to kind and subject independently of current flags", async () => {
    const owner = await actor(),
      org = await organization(owner.id),
      other = await organization(owner.id),
      item = await server(org.id);
    const requests = Array.from({ length: 43 }, (_, i) => ({
      id: `vrf_trust_${i}_${randomUUID()}`,
      requesterId: owner.id,
      targetId: org.id,
      targetType: "organization",
      status: "approved",
      resolvedAt: sql`${time}::timestamptz`,
      proofUrl: "https://private.test/proof",
      reviewNotes: "PRIVATE_PROOF",
      reviewerId: owner.id,
    }));
    await db.insert(verificationRequests).values([
      ...requests,
      ...["pending", "rejected"].map((status) => ({
        ...requests[0],
        id: `vrf_${randomUUID()}`,
        status,
      })),
      { ...requests[0], id: `vrf_${randomUUID()}`, resolvedAt: null },
      { ...requests[0], id: `vrf_${randomUUID()}`, targetType: "server" },
      { ...requests[0], id: `vrf_${randomUUID()}`, targetId: other.id },
    ]);
    const first = await trust.page("organization", org.slug),
      keys: string[] = [];
    let cursor: { createdAt: string; id: string; context: string } | undefined;
    for (let i = 0; i < 4; i++) {
      const page = await trust.page("organization", org.slug, cursor);
      expect(page.subject.verified).toBe(false);
      expect(JSON.stringify(page)).not.toMatch(
        /PRIVATE_PROOF|proofUrl|reviewNotes|requesterId|reviewerId|vrf_/u,
      );
      keys.push(...page.items.map((record) => record.key));
      if (!page.nextCursor) break;
      expect(page.nextCursor.createdAt).toBe(time);
      cursor = { ...page.nextCursor, context: page.context };
    }
    expect(keys).toEqual(
      requests
        .map((record) => createHash("md5").update(record.id).digest("hex"))
        .sort()
        .reverse(),
    );
    expect(new Set(keys).size).toBe(43);
    if (!first.nextCursor) throw new Error("Expected another approval page");
    const bound = { ...first.nextCursor, context: first.context };
    await expect(trust.page("organization", other.slug, bound)).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    await expect(trust.page("server", item.slug, bound)).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    await db.update(organizations).set({ isVerified: true }).where(eq(organizations.id, org.id));
    expect((await trust.page("organization", org.slug)).subject.verified).toBe(true);
  });
});
