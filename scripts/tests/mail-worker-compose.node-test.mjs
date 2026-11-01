import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Rendered Compose JSON required");
const config = JSON.parse(readFileSync(path, "utf8"));
const worker = config.services?.["mail-worker"];
assert(worker, "mail-worker service missing");
assert.equal(worker.restart, "unless-stopped");
assert.equal(
  worker.build,
  undefined,
  "mail-worker must use the explicitly approved image, never a build fallback",
);
assert.deepEqual(worker.ports ?? [], []);
assert.deepEqual(worker.volumes ?? [], []);
assert.equal(worker.environment?.AUTH_SECRET, undefined);
assert.equal(worker.environment?.ACCOUNT_RECOVERY_ABUSE_KEY, undefined);
assert.equal(worker.environment?.EMAIL_PROVIDER, undefined);
assert.equal(worker.environment?.NODE_ENV, "production");
assert.equal(worker.environment?.ACCOUNT_MAIL_PREVIOUS_KEY_ID, "ci-previous");
assert.equal(typeof worker.environment?.ACCOUNT_MAIL_PREVIOUS_KEY, "string");
assert(worker.environment.ACCOUNT_MAIL_PREVIOUS_KEY.length >= 43);
assert.equal(worker.environment?.ACCOUNT_MAIL_SMTP_USERNAME, "nexus-ci-user");
assert.equal(worker.environment?.ACCOUNT_MAIL_SMTP_PASSWORD, "nexus-ci-password");
assert.deepEqual(worker.command, [
  "sh",
  "-c",
  "cd /app/packages/db && exec node --import tsx scripts/run-account-mail-dispatcher.ts --ready",
]);

// Optional mail overlay must keep the production-base writer inventory (OPS-04/12).
for (const name of [
  "app",
  "push-worker",
  "license-worker",
  "resource-release-worker",
  "postgres",
]) {
  assert(config.services?.[name], `production-base role missing beside mail-worker: ${name}`);
}

// OPS-15: mail-worker keeps the hardened writable profile; license/resource-release match it.
assert.equal(worker.read_only, true);
assert.equal(worker.pids_limit, 128);
assert.deepEqual(worker.cap_drop, ["ALL"]);
assert.ok(worker.tmpfs?.some((entry) => String(entry).startsWith("/tmp:")));
assert.equal(worker.environment?.HOME, "/tmp");
assert.equal(worker.environment?.TMPDIR, "/tmp");

for (const name of ["license-worker", "resource-release-worker"]) {
  const peer = config.services[name];
  assert.equal(peer.read_only, true, `${name} read_only`);
  assert.equal(peer.pids_limit, 128, `${name} pids_limit`);
  assert.deepEqual(peer.cap_drop, ["ALL"], `${name} cap_drop`);
  assert.ok(
    peer.tmpfs?.some((entry) => String(entry).startsWith("/tmp:")),
    `${name} tmpfs`,
  );
  assert.equal(peer.environment?.HOME, "/tmp", `${name} HOME`);
  assert.equal(peer.environment?.TMPDIR, "/tmp", `${name} TMPDIR`);
}
