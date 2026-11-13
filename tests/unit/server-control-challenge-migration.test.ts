import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("server control challenge migration contract", () => {
  it("persists digest/evidence metadata but no plaintext token column", () => {
    const migration = read("packages/db/migrations/0019_server_claim_challenges.sql");

    expect(migration).toContain('"token_digest" text NOT NULL');
    expect(migration).toContain('"source_fetched_at" timestamp with time zone');
    expect(migration).toContain('"verification_request_id" text');
    expect(migration).not.toMatch(/"token"\s+text/iu);
    expect(migration).toContain("server_claim_challenge_active_requester_unique");
    expect(migration).toContain("server_claim_challenge_evidence_check");
  });

  it("keeps migration 0019 in sequence when later migrations are added", () => {
    const journal = JSON.parse(read("packages/db/migrations/meta/_journal.json"));
    const challenge = journal.entries.find(
      (entry: { tag: string }) => entry.tag === "0019_server_claim_challenges",
    );
    expect(challenge).toMatchObject({
      idx: 19,
      tag: "0019_server_claim_challenges",
      breakpoints: true,
    });
    expect(journal.entries[18].idx).toBe(18);
    expect(journal.entries[20].idx).toBe(20);
  });
});
