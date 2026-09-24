import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Rendered Compose JSON required");
const config = JSON.parse(readFileSync(path, "utf8"));
const worker = config.services?.["mail-worker"];
assert(worker, "mail-worker service missing");
assert.equal(worker.restart, "unless-stopped");
assert.equal(worker.build, undefined, "mail-worker must use the explicitly approved image, never a build fallback");
assert.deepEqual(worker.ports ?? [], []);
assert.deepEqual(worker.volumes ?? [], []);
assert.equal(worker.environment?.AUTH_SECRET, undefined);
assert.equal(worker.environment?.ACCOUNT_RECOVERY_ABUSE_KEY, undefined);
assert.equal(worker.environment?.EMAIL_PROVIDER, undefined);
assert.equal(worker.environment?.NODE_ENV, "production");
assert.equal(worker.environment?.ACCOUNT_MAIL_SMTP_USERNAME, "nexus-ci-user");
assert.equal(worker.environment?.ACCOUNT_MAIL_SMTP_PASSWORD, "nexus-ci-password");
assert(Array.isArray(worker.command) && worker.command.some((part) => String(part).endsWith("/run-account-mail-dispatcher.ts")));
