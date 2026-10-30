import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("root and db package expose notifications:delivery operator CLI", () => {
  const root = JSON.parse(read("package.json"));
  const db = JSON.parse(read("packages/db/package.json"));
  assert.equal(
    root.scripts["notifications:delivery"],
    "pnpm --filter @nexus/db notifications:delivery",
  );
  assert.equal(
    db.scripts["notifications:delivery"],
    "tsx scripts/run-notification-delivery-operator.ts",
  );
});

test("operator CLI validates reset ack before connecting and never bulk-resets", () => {
  const script = read("packages/db/scripts/run-notification-delivery-operator.ts");
  assert.match(script, /assertResetAcknowledgement/u);
  assert.match(script, /Connect only after CLI options/u);
  assert.doesNotMatch(script, /reset all|UPDATE[\s\S]*attempts = 0(?![\s\S]*WHERE)/u);
  const ops = read("docs/OPERATIONS.md");
  assert.match(ops, /pnpm notifications:delivery list --channel publication/u);
  assert.match(ops, /NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES/u);
});
