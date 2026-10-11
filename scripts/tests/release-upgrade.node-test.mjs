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

test("license recovery upgrade preserves historical uncertainty, original term and durable server identity", () => {
  const migration = readFileSync("packages/db/migrations/0053_license_binding_recovery.sql", "utf8");
  assert.match(migration, /ADD COLUMN server_owner_id text/u);
  assert.doesNotMatch(migration, /UPDATE license_runtime_bindings SET server_owner_id|UPDATE licenses SET|UPDATE (orders|payments|ledger_entries|entitlements)/u);
  assert.match(migration, /A saved binding cannot be removed while its license exists/u);
  assert.match(migration, /Bound license identity and original term are immutable/u);
  assert.match(migration, /NEW\.endpoint_revision < OLD\.endpoint_revision/u);
  assert.match(migration, /OLD\.server_owner_id IS NOT NULL/u);
  assert.match(migration, /OLD\.status = 'revoked'/u);
  assert.match(migration, /OLD\.status = 'expired' AND NEW\.status NOT IN \('expired','revoked'\)/u);
  assert.match(migration, /AFTER UPDATE OF status, expires_at ON licenses/u);
  assert.match(migration, /token_digest = NULL, token_issued_at = NULL/u);
  assert.match(migration, /NEW\.token_expires_at > parent\.expires_at/u);
  const rehearsal = readFileSync("packages/db/scripts/check-release-upgrade.mjs", "utf8");
  assert.match(rehearsal, /licenseBindingRecoverySchemaPresent = true/u);
});

test("purchase case upgrade adds immutable order context without changing historical financial states", () => {
  const migration = readFileSync("packages/db/migrations/0052_commerce_order_cases.sql", "utf8");
  assert.match(migration, /order_id text NOT NULL UNIQUE REFERENCES orders/u);
  assert.match(migration, /Purchase case context is immutable/u);
  assert.match(migration, /NEW\.revision := OLD\.revision \+ 1/u);
  assert.match(migration, /ticket\.requester_id <> parent\.buyer_id/u);
  assert.match(migration, /recorded_only/u);
  assert.doesNotMatch(migration, /UPDATE (orders|payments|ledger_entries|licenses|entitlements)|DELETE FROM/u);
  const rehearsal = readFileSync("packages/db/scripts/check-release-upgrade.mjs", "utf8");
  assert.match(rehearsal, /commerceOrderCaseSchemaPresent = true/u);
});

const script = "packages/db/scripts/check-release-upgrade.mjs";
test("term maintenance upgrade adds exact-term idempotency without rewriting historical licenses", () => {
  const migration = readFileSync(
    "packages/db/migrations/0054_license_term_maintenance.sql",
    "utf8",
  );
  assert.match(migration, /PRIMARY KEY \(license_id, event, expires_at\)/u);
  assert.match(migration, /parent\.expires_at IS DISTINCT FROM NEW\.expires_at/u);
  assert.match(migration, /NOT isfinite\(NEW\.expires_at\)/u);
  assert.match(migration, /FOR NO KEY UPDATE/u);
  assert.match(migration, /Processed license term events are immutable/u);
  assert.match(migration, /interval '3 days'/u);
  assert.doesNotMatch(migration, /UPDATE (licenses|payments|orders|entitlements|ledger_entries)/u);
  assert.match(readFileSync(script, "utf8"), /licenseTermMaintenanceSchemaPresent = true/u);
});
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
  assert.equal(plan.targetTag, "0054_license_term_maintenance");

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

test("upgrade fixture requires the server activity target index", () => {
  const migration = readFileSync(new URL("0037_server_activity_lookup_index.sql", migrationsUrl), "utf8");
  assert.match(migration, /CREATE INDEX "audit_events_target_created_id_idx"/u);
  assert.match(migration, /"target_type", "target_id", "created_at" DESC, "id" DESC/u);
  const rehearsal = readFileSync(script, "utf8");
  assert.match(rehearsal, /serverActivityIndexPresent = true/u);
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

test("upgrade keeps legacy claim scopes unbound and indexes private claim status", () => {
  const migration = readFileSync(new URL("0038_server_claim_scope_and_status.sql", migrationsUrl), "utf8");
  assert.match(migration, /"claim_scope_recorded" boolean NOT NULL DEFAULT false/u);
  assert.match(migration, /"claim_organization_id" text/u);
  assert.doesNotMatch(migration, /REFERENCES|UPDATE|DELETE/u);
  assert.match(migration, /CREATE INDEX "verification_requests_target_created_id_idx"/u);
  const rehearsal = readFileSync(script, "utf8");
  assert.match(rehearsal, /legacyProof\[0\]\.claim_scope_recorded, false/u);
  assert.match(rehearsal, /legacyProof\[0\]\.claim_organization_id, null/u);
  assert.match(rehearsal, /serverClaimScopePresent = true/u);
});


test("review upgrade preserves legacy evidence and indexes separate commercial queues", () => {
  const migration = readFileSync(new URL("0050_resource_review_lifecycle.sql", migrationsUrl), "utf8");
  assert.match(migration, /review_access_source TEXT;/u);
  assert.match(migration, /NOT VALID/u);
  assert.doesNotMatch(migration, /UPDATE comments|DELETE FROM/u);
  const rehearsal = readFileSync(script, "utf8");
  assert.match(rehearsal, /legacyReview\[0\]\.review_access_source, null/u);
  assert.match(rehearsal, /resourceReviewSchemaPresent = true/u);
});


test("build workspace upgrade preserves identity and adds monotonic revisions and profile preferences", () => {
  const migration = readFileSync(new URL("0051_resource_build_workspace.sql", migrationsUrl), "utf8");
  assert.match(migration, /ADD COLUMN revision integer NOT NULL DEFAULT 1/u);
  assert.match(migration, /NEW\.revision := OLD\.revision \+ 1/u);
  assert.match(migration, /Uploaded build identity is immutable/u);
  assert.match(migration, /OLD\.status IN \('draft', 'rejected'\)/u);
  assert.match(migration, /CREATE TABLE user_profile_preferences/u);
  assert.match(migration, /show_professional_contacts boolean NOT NULL DEFAULT true/u);
  const rehearsal = readFileSync(new URL("../../packages/db/scripts/check-release-upgrade.mjs", import.meta.url), "utf8");
  assert.match(rehearsal, /- 'revision'/u);
  assert.match(rehearsal, /resourceBuildWorkspaceSchemaPresent/u);
  assert.equal((rehearsal.match(/VALUES \('upgrade-review'/gu) ?? []).length, 1);
});
