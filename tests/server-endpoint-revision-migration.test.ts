import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("server endpoint revision migration", () => {
  it("registers 0034 exactly once and preserves chronological migration history", () => {
    const journal = JSON.parse(read("packages/db/migrations/meta/_journal.json"));
    const entries = journal.entries as { idx: number; tag: string }[];
    const revisions = entries.filter(entry => entry.tag === "0034_server_endpoint_revision");
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ idx: 34, tag: "0034_server_endpoint_revision" });
    expect(entries[34]?.idx).toBe(34);
    expect(entries[33]?.idx).toBe(33);
    expect(entries.map(entry => entry.idx)).toEqual(entries.map((_, index) => index));
  });

  it("assigns revision zero to existing servers and null to legacy proofs", () => {
    const migration = read("packages/db/migrations/0034_server_endpoint_revision.sql");
    expect(migration).toContain('"endpoint_revision" integer DEFAULT 0 NOT NULL');
    expect(migration).toContain('ALTER TABLE "server_claim_challenges" ADD COLUMN "endpoint_revision" integer');
    expect(migration).toContain('"endpoint_revision" IS NULL OR "endpoint_revision" >= 0');
    expect(migration).not.toContain('UPDATE "server_claim_challenges"');
  });

  it("requires durable endpoint revision checks in issue, consume and approval", () => {
    const issue = read("packages/db/src/repositories/server-claim-challenges.ts");
    const approval = read("packages/db/src/repositories/verification.ts");
    expect(issue).toContain("endpointRevision: server.endpointRevision");
    expect(issue).toContain("challenge.endpointRevision !== server.endpointRevision");
    expect(approval).toContain("proof.endpointRevision == null");
    expect(approval).toContain("eq(servers.endpointRevision, proof.endpointRevision)");
  });
});
