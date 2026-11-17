import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const utilPorts = [
  "public-user-trust-copy",
  "public-verification-history-copy",
  "public-context-trust-copy",
  "verification-workspace-copy",
];
const clientPorts = ["public-user-trust"];
const serverPorts = ["public-context-trust-page"];
const safeLib = /^(?:i18n(?:\.ts$|\/)|(?:public-user-trust-contract|user-platform-copy)\.ts$)/u;
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

test("Trust rejects private, routing, server and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-trust-boundary-"));
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
  write("site/src/features/trust/components/private.ts", "export const value = 1;");
  write("site/src/features/trust/server/private-page.ts", "export const value = 1;");
  for (const port of [...clientPorts, ...utilPorts]) {
    write(`site/src/features/trust/${port}.ts`, 'export { value } from "./server/private-page";');
    write(`site/src/app/${port}.ts`, `export { value } from "../features/trust/${port}";`);
  }
  for (const port of serverPorts) {
    write(`site/src/features/trust/${port}.ts`, 'export { value } from "./server/private-page";');
    write(`site/src/app/${port}.ts`, `export { value } from "../features/trust/${port}";`);
    write(
      `site/src/features/trust/components/${port}-leak.ts`,
      `export { value } from "../server/private-page";`,
    );
  }
  write("site/src/app/deep.ts", 'export { value } from "../features/trust/components/private";');
  write(
    "site/src/features/trust/components/service.ts",
    'export type { Row } from "../../../lib/services/session";',
  );
  write("site/src/features/trust/components/db.ts", 'export type { Row } from "@nexus/db";');
  write("site/src/features/trust/components/node.ts", 'export { readFileSync } from "node:fs";');
  write(
    "site/src/features/trust/components/route.ts",
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
  for (const port of [...clientPorts, ...utilPorts]) {
    assert(rules(`features/trust/${port}.ts`).includes("trust-client-isolation"), port);
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const port of serverPorts) {
    assert.deepEqual(rules(`app/${port}.ts`), []);
    assert(rules(`features/trust/components/${port}-leak.ts`).includes("trust-client-isolation"));
  }
  for (const [name, rule] of [
    ["app/deep.ts", "trust-feature-public-api"],
    ["features/trust/components/service.ts", "trust-client-isolation"],
    ["features/trust/components/db.ts", "trust-client-isolation"],
    ["features/trust/components/node.ts", "trust-client-has-no-node-builtins"],
    ["features/trust/components/route.ts", "trust-feature-does-not-import-routing"],
  ])
    assert(rules(name).includes(rule), `${name} escaped ${rule}`);
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

test("real Trust client graphs have no transitive server dependencies", () => {
  const entries = [
    "site/src/features/trust/public-user-trust.ts",
    "site/src/features/trust/components/public-user-trust.tsx",
  ];
  const result = cruise(root, entries);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const modules = new Map(graph.modules.map((module) => [module.source, module]));
  const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    assert(!/^site\/src\/features\/trust\/server\//u.test(name), name);
    assert(!/^site\/packages\/(?:db|storage|security|config)\//u.test(name), name);
    if (name.startsWith("site/src/lib/"))
      assert(safeLib.test(name.slice("site/src/lib/".length)), name);
    for (const edge of modules.get(name)?.dependencies || []) {
      assert(!edge.couldNotResolve, `${name} → ${edge.module}`);
      assert(!edge.dependencyTypes?.includes("core"), `${name} → ${edge.resolved}`);
      if (edge.resolved) visit(edge.resolved);
    }
  }
  for (const entry of entries) visit(entry.replace(/^\.\//, ""));
});
