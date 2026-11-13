import assert from "node:assert/strict";
import test from "node:test";
import { classifyChanges, requiredJobs } from "../ci-policy.mjs";

const moves = [
  ["apps/web/next.config.mjs", "site/next.config.mjs"],
  ["apps/web/src/app/api/auth/login/route.ts", "site/src/app/api/auth/login/route.ts"],
  ["apps/web/src/app/api/products/[id]/route.ts", "site/src/app/api/products/[id]/route.ts"],
  ["apps/web/src/lib/browser-route-adapter.ts", "site/src/lib/browser-route-adapter.ts"],
  ["packages/config/src/index.ts", "site/packages/config/src/index.ts"],
  ["packages/security/src/policy.ts", "site/packages/security/src/policy.ts"],
  ["packages/storage/src/provider.ts", "site/packages/storage/src/provider.ts"],
  ["packages/db/migrations/0091.sql", "site/packages/db/migrations/0091.sql"],
  [
    "packages/db/scripts/run-web-push-dispatcher.ts",
    "site/packages/db/scripts/run-web-push-dispatcher.ts",
  ],
  ["packages/db/src/schema.ts", "site/packages/db/src/schema.ts"],
  [
    "packages/db/src/repositories/initiating-session.ts",
    "site/packages/db/src/repositories/initiating-session.ts",
  ],
  [
    "packages/db/src/repositories/library-collections.ts",
    "site/packages/db/src/repositories/library-collections.ts",
  ],
  [
    "packages/db/src/repositories/web-push-admission-recovery.ts",
    "site/packages/db/src/repositories/web-push-admission-recovery.ts",
  ],
  ["tests/mainline-repository-policy.test.ts", "site/tests/mainline-repository-policy.test.ts"],
  ["tests/browser-api-route-inventory.test.ts", "site/tests/browser-api-route-inventory.test.ts"],
  ["Dockerfile", "docker/Dockerfile"],
  ["compose.yaml", "docker/compose.yaml"],
  ["compose.production.yaml", "docker/compose.production.yaml"],
  ["deploy/Caddyfile", "docker/Caddyfile"],
  ["deploy/infra-image-pins.json", "docker/infra-image-pins.json"],
];

test("sensitive legacy and destination paths independently require full acceptance", () => {
  for (const [from, to] of moves) {
    for (const files of [[from], [to], [from, to], [to, "docs/STRUCTURE-REFACTORING.md"]]) {
      const policy = classifyChanges(files);
      assert.equal(policy.full, true, files.join(", "));
      assert.equal(policy.unitOnly, false, files.join(", "));
      assert.ok(requiredJobs(policy).includes("production-compose"));
    }
  }
});

test("migration preserves UI scope without narrowing mixed or unknown changes", () => {
  for (const [from, to] of [
    ["apps/web/src/components/card.tsx", "site/src/components/card.tsx"],
    ["packages/ui/src/button.tsx", "site/packages/ui/src/button.tsx"],
  ])
    assert.deepEqual(classifyChanges([to]), classifyChanges([from]));
  for (const files of [
    ["site/src/lib/service.ts"],
    ["site/src/components/card.tsx", "site/src/app/api/search/route.ts"],
    ["site/packages/domain/src/unknown.ts"],
    ["site/unknown-script.mjs"],
  ]) {
    const policy = classifyChanges(files);
    assert.equal(policy.code, true);
    assert.equal(policy.unitOnly, false);
    assert.ok(requiredJobs(policy).includes("verify"));
  }
});
