import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { releaseUpgradePlan } from "./release-upgrade-contract.mjs";

// Never connect to an operator's database. This rehearsal owns one new database
// on the hosted runner's loopback PostgreSQL service, with no production secrets.
assert.equal(process.env.GITHUB_ACTIONS, "true", "Upgrade rehearsal requires hosted CI");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted", "Upgrade rehearsal requires hosted CI");
assert.equal(process.env.NODE_ENV, "test", "Upgrade rehearsal requires test configuration");
const url = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1"].includes(url.hostname), "Only loopback PostgreSQL is allowed");
assert.equal(url.pathname, "/mta_nexus_test", "Only the disposable CI service is allowed");

const root = fileURLToPath(new URL("../../../", import.meta.url));
const migrationsFolder = join(root, "packages/db/migrations");
const journal = JSON.parse(
  readFileSync(
    join(migrationsFolder, "meta/_journal.json"),
    "utf8",
  ),
);
const upgradePlan = releaseUpgradePlan(journal);
const temp = mkdtempSync(join(tmpdir(), "nexus-upgrade-"));
const baselineFolder = join(temp, "baseline");
const failureFolder = join(temp, "failure");
const database = `nexus_upgrade_${randomUUID().replaceAll("-", "")}`;
const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
let client;
let created = false;
const evidence = {
  status: "FAIL",
  sha: process.env.GITHUB_SHA ?? null,
  baseline: upgradePlan.baselineTag,
  target: upgradePlan.targetTag,
  phase: "baseline",
  failedMigrationRolledBack: false,
  legacyRowsPreserved: false,
  retrySucceeded: false,
  rerunIdempotent: false,
  structuredNotificationAccepted: false,
  supportSchemaPresent: false,
  webPushSubscriptionSchemaPresent: false,
  webPushOutboxSchemaPresent: false,
  cleanupComplete: false,
};

try {
  cpSync(migrationsFolder, baselineFolder, { recursive: true });
  writeFileSync(
    join(baselineFolder, "meta/_journal.json"),
    JSON.stringify({
      ...journal,
      entries: upgradePlan.baselineEntries,
    }),
  );
  cpSync(migrationsFolder, failureFolder, { recursive: true });
  const targetPath = join(
    failureFolder,
    `${upgradePlan.failureTag}.sql`,
  );
  writeFileSync(targetPath, readFileSync(targetPath, "utf8") +
    "\n--> statement-breakpoint\nDO $$ BEGIN RAISE EXCEPTION 'nexus_upgrade_injected_failure'; END $$;\n");

  await admin.unsafe(`CREATE DATABASE "${database}"`);
  created = true;
  url.pathname = `/${database}`;
  client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: baselineFolder });
  await client`INSERT INTO users (id, email, username, display_name)
    VALUES ('upgrade-user', 'upgrade@example.invalid', 'upgrade-user', 'Existing author')`;
  await client`INSERT INTO products (id, title, slug, description, type, author_id)
    VALUES ('upgrade-resource', 'Existing resource', 'upgrade-resource', 'Preserved description', 'script', 'upgrade-user')`;
  await client`INSERT INTO builds (id, product_id, version, storage_key, sha256_hash, file_size_bytes,
    status, scan_status, scanner, scanned_at)
    VALUES ('upgrade-build', 'upgrade-resource', '1.0.0', 'resources/upgrade.lua', ${"a".repeat(64)},
    12, 'published', 'clean', 'clamav', now())`;
  await client`INSERT INTO entitlements (id, subject_type, subject_id, permission, resource_id)
    VALUES ('upgrade-entitlement', 'user', 'upgrade-user', 'download', 'upgrade-resource')`;
  await client`INSERT INTO notifications (id, recipient_id, title, message, link, is_read)
    VALUES ('upgrade-notification', 'upgrade-user', 'Legacy title', 'Legacy message', '/workspace', true)`;

  const rows = async () => {
    const result = {};
    for (const table of ["users", "products", "builds", "entitlements", "notifications"]) {
      // Remove only fields introduced after the frozen baseline so existing
      // legacy-row values remain byte-for-byte comparable across the upgrade.
      const rowJson = table === "notifications"
        ? "to_jsonb(t) - 'data'"
        : table === "builds"
          ? "to_jsonb(t) - 'quarantine_previous_status' - 'quarantine_reason' - 'quarantined_at' - 'quarantined_by'"
          : "to_jsonb(t)";
      result[table] = await client.unsafe(
        `SELECT ${rowJson} AS row FROM "${table}" t ORDER BY id`,
      );
    }
    return JSON.stringify(result);
  };
  const ledger = async () => JSON.stringify(await client`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`);
  const beforeRows = await rows();
  const beforeLedger = await ledger();
  evidence.phase = "injected-failure";
  await assert.rejects(migrate(db, { migrationsFolder: failureFolder }), (error) =>
    error.cause?.message?.includes("nexus_upgrade_injected_failure") === true);
  assert.equal(await ledger(), beforeLedger);
  assert.equal(await rows(), beforeRows);
  const columns = await client`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'data'`;
  assert.equal(columns.length, 0, "Failed migration must roll back its DDL");
  const failedIndexes = await client`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    AND indexname IN ('products_public_author_created_id_idx', 'products_public_org_created_id_idx', 'content_public_org_published_id_idx')`;
  assert.equal(failedIndexes.length, 0, "Failed migration must roll back its indexes");
  const failedQuarantineColumns = await client`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds'
      AND column_name IN ('quarantine_previous_status', 'quarantine_reason', 'quarantined_at', 'quarantined_by')`;
  assert.equal(failedQuarantineColumns.length, 0, "Failed migration must roll back quarantine columns");
  evidence.failedMigrationRolledBack = true;

  evidence.phase = "upgrade";
  await migrate(db, { migrationsFolder });
  const afterLedger = await ledger();
  const count = await client`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
  assert.equal(count[0].count, journal.entries.length);
  const indexes = await client`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    AND indexname IN ('products_public_author_created_id_idx', 'products_public_org_created_id_idx', 'content_public_org_published_id_idx')`;
  assert.equal(indexes.length, 3);
  const quarantineColumns = await client`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'builds'
      AND column_name IN ('quarantine_previous_status', 'quarantine_reason', 'quarantined_at', 'quarantined_by')`;
  assert.equal(quarantineColumns.length, 4);
  const supportTables = await client`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('support_cases', 'support_case_messages')
    ORDER BY table_name`;
  assert.deepEqual(
    supportTables.map((row) => row.table_name),
    ["support_case_messages", "support_cases"],
  );
  evidence.supportSchemaPresent = true;

  const pushTables = await client`SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'web_push_subscriptions',
        'web_push_queue_gate',
        'web_push_outbox'
      )
    ORDER BY table_name`;
  assert.deepEqual(
    pushTables.map((row) => row.table_name),
    [
      "web_push_outbox",
      "web_push_queue_gate",
      "web_push_subscriptions",
    ],
  );
  evidence.webPushSubscriptionSchemaPresent = true;

  const pushIndexes = await client`SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'web_push_outbox_notification_subscription_idx',
        'web_push_outbox_due_idx',
        'web_push_outbox_lease_idx',
        'web_push_outbox_expiry_idx'
      )
    ORDER BY indexname`;
  assert.deepEqual(
    pushIndexes.map((row) => row.indexname),
    [
      "web_push_outbox_due_idx",
      "web_push_outbox_expiry_idx",
      "web_push_outbox_lease_idx",
      "web_push_outbox_notification_subscription_idx",
    ],
  );
  const queueGate = await client`
    SELECT singleton, capacity
    FROM web_push_queue_gate
  `;
  assert.equal(queueGate.length, 1);
  assert.equal(queueGate[0].singleton, true);
  assert.equal(queueGate[0].capacity, 10_000);
  const outboxCount = await client`
    SELECT count(*)::int AS count
    FROM web_push_outbox
  `;
  assert.equal(outboxCount[0].count, 0);
  evidence.webPushOutboxSchemaPresent = true;
  assert.equal(await rows(), beforeRows);
  const old = await client`SELECT data, is_read FROM notifications WHERE id = 'upgrade-notification'`;
  assert.equal(old[0].data, null);
  assert.equal(old[0].is_read, true);
  evidence.legacyRowsPreserved = true;
  evidence.retrySucceeded = true;

  evidence.phase = "idempotency";
  await migrate(db, { migrationsFolder });
  assert.equal(await ledger(), afterLedger);
  assert.equal(await rows(), beforeRows);
  evidence.rerunIdempotent = true;
  evidence.phase = "structured-notification";
  const data = { kind: "build_review", decision: "approve", resourceTitle: "Existing resource", version: "1.0.0", notes: "Reviewed" };
  // Drizzle changes this client's JSON serializers. Bind serialized JSON as
  // text and cast explicitly instead of using postgres.js's original json helper.
  await client`INSERT INTO notifications (id, recipient_id, title, message, data)
    VALUES ('upgrade-new-notification', 'upgrade-user', 'Review', 'Approved', ${JSON.stringify(data)}::jsonb)`;
  const added = await client`SELECT data FROM notifications WHERE id = 'upgrade-new-notification'`;
  assert.deepEqual(added[0].data, data);
  evidence.structuredNotificationAccepted = true;
  evidence.phase = "complete";
  evidence.status = "PASS";
} catch {
  // Driver errors can include SQL/connection configuration; evidence stays secret-safe.
  evidence.status = "FAIL";
} finally {
  try {
    if (client) await client.end({ timeout: 5 });
    if (created) await admin.unsafe(`DROP DATABASE "${database}"`);
    evidence.cleanupComplete = true;
  } catch {
    evidence.status = "FAIL";
  }
  await admin.end({ timeout: 5 });
  rmSync(temp, { recursive: true, force: true });
  mkdirSync(join(root, "artifacts"), { recursive: true });
  writeFileSync(join(root, "artifacts/release-upgrade.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(evidence, null, 2));
}
assert.equal(evidence.status, "PASS", "Existing-installation upgrade rehearsal failed");
