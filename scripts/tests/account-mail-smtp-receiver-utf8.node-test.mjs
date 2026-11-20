import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const source = readFileSync(join(root, "scripts/tests/account-mail-smtp-receiver.mjs"), "utf8");

test("CI SMTP receiver advertises SMTPUTF8 and 8BITMIME for bilingual mail", () => {
  assert.match(source, /250-8BITMIME/);
  assert.match(source, /250-SMTPUTF8/);
  assert.match(source, /250-AUTH PLAIN/);
});
