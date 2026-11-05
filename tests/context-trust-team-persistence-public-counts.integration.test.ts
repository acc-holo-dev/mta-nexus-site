import { describe, expect, it } from "vitest";
import {
  actor,
  content,
  db,
  organization,
  randomUUID,
  server,
  setupContextTrustTeamPersistence,
  trust,
} from "./helpers/context-trust-team-persistence-harness";

setupContextTrustTeamPersistence();

describe("context trust team persistence: public counts", () => {
  it("correlates each public count to the selected organization and excludes private, inactive and commercial rows", async () => {
    const owner = await actor(),
      org = await organization(owner.id),
      other = await organization(owner.id);
    const publicServer = await server(org.id, { isVerified: true });
    await server(org.id);
    await server(org.id, { visibility: "private", isVerified: true });
    await server(org.id, { visibility: "unlisted", isVerified: true });
    await server(org.id, { status: "inactive", isVerified: true });
    await server(other.id, { isVerified: true });
    const base = {
      authorId: owner.id,
      title: "Public item",
      body: "Fixture",
      type: "post",
      status: "published",
    };
    await db.insert(content).values([
      { ...base, id: `cnt_${randomUUID()}`, slug: `trust-${randomUUID()}`, organizationId: org.id },
      {
        ...base,
        id: `cnt_${randomUUID()}`,
        slug: `trust-${randomUUID()}`,
        organizationId: org.id,
        serverId: publicServer.id,
      },
      {
        ...base,
        id: `cnt_${randomUUID()}`,
        slug: `trust-${randomUUID()}`,
        organizationId: org.id,
        status: "draft",
      },
      {
        ...base,
        id: `cnt_${randomUUID()}`,
        slug: `trust-${randomUUID()}`,
        organizationId: org.id,
        type: "resource",
      },
      {
        ...base,
        id: `cnt_${randomUUID()}`,
        slug: `trust-${randomUUID()}`,
        organizationId: other.id,
      },
      { ...base, id: `cnt_${randomUUID()}`, slug: `trust-${randomUUID()}` },
    ]);
    expect((await trust.page("organization", org.slug)).subject).toMatchObject({
      publications: 2,
      servers: { total: 2, verified: 1 },
    });
    expect((await trust.page("organization", other.slug)).subject).toMatchObject({
      publications: 1,
      servers: { total: 1, verified: 1 },
    });
    expect((await trust.page("server", publicServer.slug)).subject.publications).toBe(1);
  });
});
