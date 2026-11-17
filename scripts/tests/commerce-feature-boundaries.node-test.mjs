import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const clientPorts = [
  "workspace-history",
  "license-controls",
  "subscription-controls",
  "order-cancellation",
  "order-case-forms",
];
const safeLib =
  /^(?:i18n(?:\.ts$|\/)|(?:commerce-history-format|commerce-history-i18n|commercial-confirmation|commercial-i18n|license-control-i18n|license-control-confirmation|license-runtime-response|order-case-i18n|order-case-response|plan-reviews-i18n|private-api-request|subscription-confirmation|subscriptions-i18n|subscriptions-query|support-retry)\.ts$)/u;

function cruise(cwd, entries, output = "json") {
  return spawnSync(
    process.execPath,
    [cruiser, "--config", config, "--output-type", output, ...entries],
    {
      cwd,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
}

test("Commerce rejects private, routing and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-commerce-boundary-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  function write(name, content) {
    const file = join(fixture, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        paths: { "@nexus/db": ["./site/packages/db/src/index.ts"] },
      },
    }),
  );
  write("site/packages/db/src/index.ts", "export type Row = string;");
  write("site/src/lib/services/session.ts", 'export type { Row } from "@nexus/db";');
  write("site/src/features/commerce/components/private.ts", "export const value = 1;");
  for (const port of clientPorts) {
    write(
      `site/src/features/commerce/${port}.ts`,
      'export type { Row } from "../../lib/services/session";',
    );
    write(`site/src/app/${port}.ts`, `export { value } from "../features/commerce/${port}";`);
  }
  write("site/src/app/deep.ts", 'export { value } from "../features/commerce/components/private";');
  write(
    "site/src/features/commerce/components/service.ts",
    'export type { Row } from "../../../lib/services/session";',
  );
  write("site/src/features/commerce/components/db.ts", 'export type { Row } from "@nexus/db";');
  write("site/src/features/commerce/components/node.ts", 'export { readFileSync } from "node:fs";');
  write(
    "site/src/features/commerce/components/route.ts",
    'export { value } from "../../../app/deep";',
  );
  const result = cruise(fixture, ["site/src", "site/packages"]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const rules = (name) => {
    const mod = graph.modules.find((item) => item.source === `site/src/${name}`);
    assert(mod, name);
    return mod.dependencies.flatMap((edge) => edge.rules?.map((rule) => rule.name) || []);
  };
  for (const port of clientPorts) {
    assert(rules(`features/commerce/${port}.ts`).includes("commerce-client-isolation"), port);
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const [name, rule] of [
    ["app/deep.ts", "commerce-feature-public-api"],
    ["features/commerce/components/service.ts", "commerce-client-isolation"],
    ["features/commerce/components/db.ts", "commerce-client-isolation"],
    ["features/commerce/components/node.ts", "commerce-client-has-no-node-builtins"],
    ["features/commerce/components/route.ts", "commerce-feature-does-not-import-routing"],
  ])
    assert(rules(name).includes(rule), `${name} escaped ${rule}`);
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

function assertClientGraphsHaveNoServerLeaks(entries) {
  const result = cruise(root, entries);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const modules = new Map(graph.modules.map((module) => [module.source, module]));
  const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    assert(!/^site\/packages\/(?:db|storage|security|config)\//u.test(name), name);
    if (name.startsWith("site/src/lib/"))
      assert(safeLib.test(name.slice("site/src/lib/".length)), name);
    for (const edge of modules.get(name)?.dependencies || []) {
      assert(!edge.couldNotResolve, `${name} → ${edge.module}`);
      assert(!edge.dependencyTypes?.includes("core"), `${name} → ${edge.resolved}`);
      assert(!/server-only|next\/headers/u.test(edge.resolved), edge.resolved);
      if (edge.resolved) visit(edge.resolved);
    }
  }
  for (const entry of entries) visit(entry.replace(/^\.\//, ""));
}

test("real Commerce workspace-history graphs have no transitive server dependencies", () => {
  assertClientGraphsHaveNoServerLeaks([
    "site/src/features/commerce/workspace-history.ts",
    "site/src/features/commerce/components/workspace-history.tsx",
  ]);
});

test("real Commerce license-controls graphs have no transitive server dependencies", () => {
  assertClientGraphsHaveNoServerLeaks([
    "site/src/features/commerce/license-controls.ts",
    "site/src/features/commerce/components/license-control-panel.tsx",
    "site/src/features/commerce/components/license-runtime-probe.tsx",
  ]);
});

test("real Commerce subscription-controls graphs have no transitive server dependencies", () => {
  assertClientGraphsHaveNoServerLeaks([
    "site/src/features/commerce/subscription-controls.ts",
    "site/src/features/commerce/components/subscription-controls.tsx",
    "site/src/features/commerce/components/subscription-fee-estimator.tsx",
    "site/src/features/commerce/components/subscription-recovery.tsx",
  ]);
});

test("real Commerce order-cancellation graphs have no transitive server dependencies", () => {
  assertClientGraphsHaveNoServerLeaks([
    "site/src/features/commerce/order-cancellation.ts",
    "site/src/features/commerce/components/order-cancellation-form.tsx",
  ]);
});

test("real Commerce order-case-forms graphs have no transitive server dependencies", () => {
  assertClientGraphsHaveNoServerLeaks([
    "site/src/features/commerce/order-case-forms.ts",
    "site/src/features/commerce/components/order-case-forms.tsx",
  ]);
});
