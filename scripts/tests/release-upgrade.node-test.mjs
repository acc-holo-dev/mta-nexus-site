import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import test from "node:test";
import {
  RELEASE_UPGRADE_TARGET_TAG,
  releaseUpgradePlan,
} from "../../packages/db/scripts/release-upgrade-contract.mjs";

const script = "packages/db/scripts/check-release-upgrade.mjs";
const ci = {
  GITHUB_ACTIONS: "true",
  RUNNER_ENVIRONMENT: "github-hosted",
  NODE_ENV: "test",
  DATABASE_URL: "postgres://nexus:never-print-this-secret@localhost/mta_nexus_test",
};

for (const [name, overrides, expected] of [
  ["local runner", { GITHUB_ACTIONS: "false" }, "requires hosted CI"],
  ["self-hosted runner", { RUNNER_ENVIRONMENT: "self-hosted" }, "requires hosted CI"],
  ["production configuration", { NODE_ENV: "production" }, "requires test configuration"],
  ["remote database", { DATABASE_URL: "postgres://nexus:never-print-this-secret@production.invalid/mta_nexus_test" }, "Only loopback PostgreSQL"],
  ["different database", { DATABASE_URL: "postgres://nexus:never-print-this-secret@localhost/production" }, "Only the disposable CI service"],
]) {
  test(`upgrade rehearsal refuses ${name} before connecting`, () => {
    const result = spawnSync(process.execPath, [script], {
      env: { PATH: process.env.PATH, ...ci, ...overrides },
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert(result.stderr.includes(expected));
    assert(!result.stderr.includes("never-print-this-secret"));
    assert(!result.stderr.includes("ECONNREFUSED"));
    assert.equal(result.stdout, "");
  });
}


const journalUrl = new URL(
  "../../packages/db/migrations/meta/_journal.json",
  import.meta.url,
);
const migrationsUrl = new URL(
  "../../packages/db/migrations/",
  import.meta.url,
);

test("upgrade contract tracks the latest real migration journal", () => {
  const journal = JSON.parse(
    readFileSync(journalUrl, "utf8"),
  );
  const plan = releaseUpgradePlan(journal);

  assert.equal(
    plan.targetIndex,
    journal.entries.length - 1,
  );
  assert.equal(
    journal.entries.at(-1)?.tag,
    RELEASE_UPGRADE_TARGET_TAG,
  );
  assert(
    existsSync(
      new URL(
        `${plan.baselineTag}.sql`,
        migrationsUrl,
      ),
    ),
  );
  assert(
    existsSync(
      new URL(
        `${plan.failureTag}.sql`,
        migrationsUrl,
      ),
    ),
  );
  assert(
    existsSync(
      new URL(
        `${plan.targetTag}.sql`,
        migrationsUrl,
      ),
    ),
  );
  assert.equal(
    plan.baselineEntries.at(-1)?.tag,
    plan.baselineTag,
  );
});

test("upgrade contract requires the filtered staff queue migration", () => {
  const journal = JSON.parse(readFileSync(journalUrl, "utf8"));
  const plan = releaseUpgradePlan(journal);
  assert.equal(plan.targetTag, "0036_user_library_lookup_indexes");

  const indexMigration = readFileSync(
    new URL("0032_support_staff_filter_index.sql", migrationsUrl),
    "utf8",
  );
  assert.match(indexMigration, /CREATE INDEX "support_cases_category_status_updated_id_idx"/u);
  assert.match(indexMigration, /"category","status","updated_at","id"/u);

  const rehearsal = readFileSync(script, "utf8");
  assert.match(rehearsal, /'support_cases_status_updated_id_idx'/u);
  assert.match(rehearsal, /'support_cases_category_status_updated_id_idx'/u);
  assert.match(rehearsal, /supportStaffFilterIndexPresent = true/u);
});

test("upgrade fixture requires indexed effective download rights", () => {
  const migration = readFileSync(
    new URL("0036_user_library_lookup_indexes.sql", migrationsUrl),
    "utf8",
  );
  assert.match(migration, /CREATE INDEX "entitlements_user_download_library_idx"/u);
  assert.match(migration, /CREATE INDEX "licenses_user_active_library_idx"/u);
  assert.match(migration, /"subject_type" = 'user'/u);
  assert.match(migration, /"status" = 'active'/u);
  const rehearsal = readFileSync(script, "utf8");
  assert.match(rehearsal, /userLibraryIndexesPresent = true/u);
});

test("upgrade fixture checks durable support mutation idempotency", () => {
  const migration = readFileSync(
    new URL("0033_support_mutation_idempotency.sql", migrationsUrl),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE "support_mutation_requests"/u);
  assert.match(migration, /PRIMARY KEY \("actor_id", "request_key"\)/u);
  const rehearsal = readFileSync(script, "utf8");
  assert.match(rehearsal, /supportMutationIdempotencyPresent = true/u);
});

test("upgrade fixture checks endpoint revisions and legacy proofs", () => {
  const rehearsal = readFileSync(script, "utf8");
  assert.match(rehearsal, /INSERT INTO server_claim_challenges/u);
  assert.match(rehearsal, /endpoint\[0\]\.endpoint_revision, 0/u);
  assert.match(rehearsal, /legacyProof\[0\]\.endpoint_revision, null/u);
  assert.match(rehearsal, /servers_endpoint_revision_nonnegative/u);
  assert.match(rehearsal, /server_claim_endpoint_revision_nonnegative/u);
  assert.match(rehearsal, /serverEndpointRevisionPresent = true/u);
  assert.match(rehearsal, /legacyServerProofInvalidated = true/u);
});

test("upgrade contract fails fast when a new migration advances the journal", () => {
  const journal = JSON.parse(
    readFileSync(journalUrl, "utf8"),
  );
  const next = {
    ...journal,
    entries: [
      ...journal.entries,
      {
        idx: journal.entries.length,
        version: "7",
        when: Date.now(),
        tag: "0036_requires_fixture_review",
        breakpoints: true,
      },
    ],
  };

  assert.throws(
    () => releaseUpgradePlan(next),
    /target must match latest migration/u,
  );
});

test("upgrade contract rejects reordered or missing required migrations", () => {
  const journal = JSON.parse(
    readFileSync(journalUrl, "utf8"),
  );
  const reordered = {
    ...journal,
    entries: journal.entries.map((entry, index) => ({
      ...entry,
      idx: index === 1 ? 99 : entry.idx,
    })),
  };
  assert.throws(
    () => releaseUpgradePlan(reordered),
    /indexes must be contiguous/u,
  );

  const missing = {
    ...journal,
    entries: journal.entries.filter(
      (entry) =>
        entry.tag !== "0027_build_quarantine",
    ),
  };
  assert.throws(
    () => releaseUpgradePlan(missing),
    /missing required migration/u,
  );
});
