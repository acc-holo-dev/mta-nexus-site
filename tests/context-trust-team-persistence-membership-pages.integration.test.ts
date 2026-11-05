import { describe, expect, it } from "vitest";
import {
  actor,
  db,
  directory,
  member,
  organization,
  organizationMembers,
  randomUUID,
  setupContextTrustTeamPersistence,
  sql,
  time,
  trackActors,
  users,
} from "./helpers/context-trust-team-persistence-harness";

setupContextTrustTeamPersistence();

describe("context trust team persistence: membership pages", () => {
  it("traverses membership keys at exact microsecond boundaries and binds pages to current account, organization and filters", async () => {
    const owner = await actor(),
      org = await organization(owner.id),
      other = await organization(owner.id),
      reader = await actor();
    const people = Array.from({ length: 43 }, (_, i) => {
      const key = randomUUID().replaceAll("-", "");
      return {
        id: `usr_trust_${key}`,
        username: `trust_${key}`,
        email: `${key}@nexus.test`,
        displayName: `Team ${i}`,
      };
    });
    trackActors(...people.map((row) => row.id));
    await db.insert(users).values(people);
    const memberships = people.map((person) => ({
      id: `mem_${randomUUID()}`,
      organizationId: org.id,
      userId: person.id,
      role: "member",
      createdAt: sql`${time}::timestamptz`,
    }));
    await db.insert(organizationMembers).values(memberships);
    await member(org.id, reader.id);
    const ids: string[] = [];
    let cursor: { createdAt: string; id: string; context: string } | undefined;
    const first = await directory.page(org.id, owner.id, { query: "Team " });
    for (let i = 0; i < 4; i++) {
      const page = await directory.page(org.id, owner.id, { query: "Team ", cursor });
      expect(page.owner?.id).toBe(owner.id);
      ids.push(...page.members.map((row) => row.id));
      if (!page.nextCursor) break;
      expect(page.nextCursor.createdAt).toBe(time);
      cursor = { ...page.nextCursor, context: page.context };
    }
    expect(ids).toEqual(
      [...memberships].sort((a, b) => b.id.localeCompare(a.id)).map((row) => row.userId),
    );
    expect(new Set(ids).size).toBe(43);
    if (!first.nextCursor) throw new Error("Expected another team page");
    const bound = { ...first.nextCursor, context: first.context };
    await expect(
      directory.page(org.id, reader.id, { query: "Team ", cursor: bound }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await expect(
      directory.page(other.id, owner.id, { query: "Team ", cursor: bound }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await expect(
      directory.page(org.id, owner.id, { query: "", cursor: bound }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });
});
