import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const serverPorts = ["admin-home"];
const utilPorts = [
  "storage-maintenance-i18n",
,
  "verification-applications-copy",
];
const clientPorts = ["storage-maintenance"];
const safeLib =
  /^(?:i18n(?:\.ts$|\/)|(?:platform-report-i18n|private-api-request|admin-action-confirmation|community-report-copy|order-case-i18n|resource-review-i18n|user-platform-copy|user-platform-client|user-platform-contract|verification-applications-contract|content-discussion-contract|verification-workspace-contract|verification-workspace-copy)\.ts$)/u;

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

test("Moderation rejects private, routing and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-moderation-boundary-"));
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
  write("site/src/features/moderation/components/private.ts", "export const value = 1;");
  for (const port of serverPorts) {
    write(
      `site/src/features/moderation/${port}.ts`,
      'export type { Row } from "../../lib/services/session";',
    );
    write(`site/src/app/${port}.ts`, `export { value } from "../features/moderation/${port}";`);
  }
  for (const port of [...clientPorts, ...utilPorts]) {
    write(
      `site/src/features/moderation/${port}.ts`,
      'export type { Row } from "../../lib/services/session";',
    );
    write(`site/src/app/${port}.ts`, `export { value } from "../features/moderation/${port}";`);
  }
  write(
    "site/src/app/deep.ts",
    'export { value } from "../features/moderation/components/private";',
  );
  write(
    "site/src/features/moderation/components/service.ts",
    'export type { Row } from "../../../lib/services/session";',
  );
  write("site/src/features/moderation/components/db.ts", 'export type { Row } from "@nexus/db";');
  write(
    "site/src/features/moderation/components/node.ts",
    'export { readFileSync } from "node:fs";',
  );
  write(
    "site/src/features/moderation/components/route.ts",
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
  for (const port of serverPorts) {
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const port of [...clientPorts, ...utilPorts]) {
    assert(rules(`features/moderation/${port}.ts`).includes("moderation-client-isolation"), port);
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const [name, rule] of [
    ["app/deep.ts", "moderation-feature-public-api"],
    ["features/moderation/components/service.ts", "moderation-client-isolation"],
    ["features/moderation/components/db.ts", "moderation-client-isolation"],
    ["features/moderation/components/node.ts", "moderation-client-has-no-node-builtins"],
    ["features/moderation/components/route.ts", "moderation-feature-does-not-import-routing"],
  ])
    assert(rules(name).includes(rule), `${name} escaped ${rule}`);
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

test("real Moderation admin-home graphs stay within staff UI allowlist", () => {
  const entries = [
    "site/src/features/moderation/admin-home.ts",
    "site/src/features/moderation/components/admin-reports-section.tsx",
    "site/src/features/moderation/components/admin-builds-quarantine-section.tsx",
  ];
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
      if (!edge.resolved) continue;
      if (
        edge.resolved.startsWith("site/src/features/") &&
        !edge.resolved.includes("/features/moderation/")
      ) {
        continue;
      }
      visit(edge.resolved);
    }
  }
  for (const entry of entries) visit(entry.replace(/^\.\//, ""));
});

test("real Moderation storage-maintenance graphs have no transitive server dependencies", () => {
  const entries = [
    "site/src/features/moderation/storage-maintenance.ts",
    "site/src/features/moderation/components/storage-maintenance-controls.tsx",
  ];
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
});
