import { describe, expect, it } from "vitest";
import {
  actor,
  db,
  eq,
  organization,
  server,
  servers,
  setupContextTrustTeamPersistence,
  trust,
} from "./helpers/context-trust-team-persistence-harness";

setupContextTrustTeamPersistence();

describe("context trust team persistence: server visibility", () => {
  it("rechecks server visibility and current ownership context without exposing endpoint or personal identity", async () => {
    const owner = await actor(),
      org = await organization(owner.id),
      item = await server(org.id, { ownerId: owner.id });
    expect((await trust.page("server", item.slug)).subject).toMatchObject({
      ownershipKind: "organization",
      organization: { slug: org.slug },
    });
    await db.update(servers).set({ organizationId: null }).where(eq(servers.id, item.id));
    const personal = await trust.page("server", item.slug);
    expect(personal.subject).toMatchObject({ ownershipKind: "personal", organization: null });
    expect(JSON.stringify(personal)).not.toMatch(/ownerId|ipAddress|port|email|usr_trust_/u);
    await db.update(servers).set({ ownerId: null }).where(eq(servers.id, item.id));
    expect((await trust.page("server", item.slug)).subject.ownershipKind).toBe("unclaimed");
    for (const fields of [
      { visibility: "private", status: "active" },
      { visibility: "unlisted", status: "active" },
      { visibility: "public", status: "inactive" },
    ]) {
      await db.update(servers).set(fields).where(eq(servers.id, item.id));
      await expect(trust.page("server", item.slug)).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
  });
});
