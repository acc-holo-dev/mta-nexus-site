import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Rendered Compose JSON required");
const config = JSON.parse(readFileSync(path, "utf8"));
const app = config.services?.app;
const worker = config.services?.["mail-worker"];
assert(app, "app service missing");
assert(worker, "mail-worker service missing");

assert.equal(app.environment?.ACCOUNT_MAIL_KEY_ID, "ci");
assert.equal(typeof app.environment?.ACCOUNT_MAIL_KEY, "string");
assert(app.environment.ACCOUNT_MAIL_KEY.length >= 43);
assert.equal(typeof app.environment?.ACCOUNT_RECOVERY_ABUSE_KEY, "string");
assert(app.environment.ACCOUNT_RECOVERY_ABUSE_KEY.length >= 43);
assert.equal(app.environment?.ACCOUNT_MAIL_PREVIOUS_KEY_ID, undefined);
assert.equal(app.environment?.ACCOUNT_MAIL_PREVIOUS_KEY, undefined);
assert.equal(app.environment?.ACCOUNT_MAIL_SMTP_USERNAME, undefined);
assert.equal(app.environment?.ACCOUNT_MAIL_SMTP_PASSWORD, undefined);

assert.equal(worker.environment?.ACCOUNT_RECOVERY_ABUSE_KEY, undefined);
assert.equal(worker.environment?.AUTH_SECRET, undefined);
assert.equal(worker.environment?.ACCOUNT_MAIL_KEY_ID, "ci");
assert.equal(worker.environment?.ACCOUNT_MAIL_PREVIOUS_KEY_ID, "ci-previous");
assert.equal(worker.environment?.ACCOUNT_MAIL_SMTP_USERNAME, "nexus-ci-user");
assert.equal(worker.environment?.ACCOUNT_MAIL_SMTP_PASSWORD, "nexus-ci-password");
