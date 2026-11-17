import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const clientPorts = [
  "collection-command",
  "collection-batch",
  "collection-item-copy",
  "collection-import",
  "collection-restore",
  "membership-batch",
  "release-follow",
  "release-selection",
];
const utilPorts = [
  "library-release-request",
  "library-membership-batch-confirmation",
  "library-selection-batches-confirmation",
  "library-membership-batches-i18n",
  "library-selection-batches-i18n",
  "collection-requirements-i18n",
  "library-collection-receipts-i18n",
];
const serverPorts = [
  "collections",
  "membership-history",
  "selection-batch",
  "release-comparison",
  "release-history",
  "collection-releases",
  "collection-requirements",
  "collection-import-page",
  "collection-reconcile-page",
  "collection-compare-page",
  "collection-receipt-page",
  "collection-history-page",
  "collection-inventory-page",
  "resource-collections-page",
];
const safeLib =
  /^(?:i18n(?:\.ts$|\/)|(?:library-collection-receipts-i18n|library-collections-confirmation|library-collections-i18n|library-collections-query|private-api-request|library-collection-manifests-i18n|library-membership-history-i18n|library-membership-history-query|library-release-comparison-i18n|resource-release-control-i18n|resource-release-control-confirmation)\.ts$)/u;
function cruise(cwd, entries, output = "json") {
  return spawnSync(
    process.execPath,
    [cruiser, "--config", config, "--output-type", output, ...entries],
    { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
}

test("Library rejects private, routing, server and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-library-boundary-"));
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
  write("site/src/features/library/components/private.ts", "export const value = 1;");
  write("site/src/features/library/server/page.ts", "export const value = 1;");
  for (const port of [...clientPorts, ...utilPorts]) {
    write(`site/src/features/library/${port}.ts`, 'export { value } from "./server/page";');
    write(`site/src/app/${port}.ts`, `export { value } from "../features/library/${port}";`);
  }
  for (const port of serverPorts) {
    write(`site/src/features/library/${port}-server.ts`, 'export { value } from "./server/page";');
    write(
      `site/src/app/${port}-server.ts`,
      `export { value } from "../features/library/${port}-server";`,
    );
    write(
      `site/src/features/library/components/${port}-leak.ts`,
      `export { value } from "../${port}-server";`,
    );
  }
  write("site/src/app/deep.ts", 'export { value } from "../features/library/components/private";');
  write(
    "site/src/features/library/components/service.ts",
    'export type { Row } from "../../../lib/services/session";',
  );
  write("site/src/features/library/components/db.ts", 'export type { Row } from "@nexus/db";');
  write("site/src/features/library/components/node.ts", 'export { readFileSync } from "node:fs";');
  write(
    "site/src/features/library/components/route.ts",
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
    assert(rules(`features/library/${port}.ts`).includes("library-client-isolation"), port);
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const port of serverPorts) {
    assert.deepEqual(rules(`app/${port}-server.ts`), []);
    assert(
      rules(`features/library/components/${port}-leak.ts`).includes("library-client-isolation"),
    );
  }
  for (const [name, rule] of [
    ["app/deep.ts", "library-feature-public-api"],
    ["features/library/components/service.ts", "library-client-isolation"],
    ["features/library/components/db.ts", "library-client-isolation"],
    ["features/library/components/node.ts", "library-client-has-no-node-builtins"],
    ["features/library/components/route.ts", "library-feature-does-not-import-routing"],
  ])
    assert(rules(name).includes(rule), `${name}: ${rule}`);
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

test("Library client graphs exclude server dependencies transitively", () => {
  const entries = [...clientPorts, ...utilPorts].map(
    (port) => `site/src/features/library/${port}.ts`,
  );
  entries.push(
    "site/src/features/library/components/library-selection-batch-controls.tsx",
    "site/src/features/library/components/library-release-comparison-selection.tsx",
  );

  const result = cruise(root, entries);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  assert.deepEqual(graph.summary.violations, []);
  const modules = new Map(graph.modules.map((mod) => [mod.source, mod]));
  const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    assert(
      !/^site\/src\/(?:app\/|features\/library\/(?:server\/|(?:collections|membership-history|selection-batch|release-comparison|release-history|collection-releases|collection-requirements|collection-import-page|collection-reconcile-page|collection-compare-page|collection-receipt-page|collection-history-page|collection-inventory-page|resource-collections-page)-server\.ts$))/u.test(
        name,
      ),
      name,
    );
    assert(!/^site\/packages\/(?:db|storage|security|config)\//u.test(name), name);
    if (name.startsWith("site/src/lib/"))
      assert(safeLib.test(name.slice("site/src/lib/".length)), name);
    for (const edge of modules.get(name)?.dependencies || []) {
      assert(!edge.couldNotResolve, `${name} → ${edge.module}`);
      assert(!edge.dependencyTypes?.includes("core"), `${name} → ${edge.resolved}`);
      assert(!/server-only|next\/headers/u.test(edge.resolved), edge.resolved);
      visit(edge.resolved);
    }
  }
  const utilPortSet = new Set(utilPorts);
  for (const entry of entries) {
    if (!entry.includes("/components/")) {
      const portName = entry.split("/").pop().replace(/\.ts$/u, "");
      if (!utilPortSet.has(portName))
        assert.match(readFileSync(resolve(root, entry), "utf8"), /^"use client";/u);
    }
    visit(entry);
  }
  for (const child of [
    "library-collection-command",
    "library-collection-batch",
    "library-collection-item-copy",
    "library-collection-import",
    "library-collection-reconcile",
    "library-collection-restore",
    "library-membership-batch",
    "library-selection-batch-controls",
    "library-release-command",
    "library-release-comparison-selection",
    "library-release-follow-latest",
    "library-release-selection-controls",
  ])
    assert(visited.has(`site/src/features/library/components/${child}.tsx`), child);
});

test("Library server entries stay server-only and separately composed", () => {
  const entries = [
    ["collections", "library-collections-screen.tsx"],
    ["membership-history", "library-membership-history-screen.tsx"],
    ["selection-batch", "library-selection-batch-screen.tsx"],
    ["release-comparison", "library-release-comparison-screen.tsx"],
    ["release-history", "library-release-history-screen.tsx"],
    ["collection-releases", "collection-releases-screen.tsx"],
    ["collection-requirements", "collection-requirements-screen.tsx"],
    ["collection-import-page", "collection-import-page.tsx"],
    ["collection-reconcile-page", "collection-reconcile-page.tsx"],
    ["collection-compare-page", "collection-compare-page.tsx"],
    ["collection-receipt-page", "collection-receipt-page.tsx"],
    ["collection-history-page", "collection-history-page.tsx"],
    ["collection-inventory-page", "collection-inventory-page.tsx"],
    ["resource-collections-page", "resource-collections-page.tsx"],
  ];
  for (const [port, page] of entries) {
    const source = `site/src/features/library/${port}-server.ts`;
    assert.match(readFileSync(resolve(root, source), "utf8"), /import "server-only"/u);
    const result = cruise(root, [source]);
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.deepEqual(graph.summary.violations, []);
    const modules = new Set(graph.modules.map((mod) => mod.source));
    assert(modules.has(`site/src/features/library/server/${page}`));
    for (const [otherPort, otherPage] of entries)
      if (otherPort !== port) assert(!modules.has(`site/src/features/library/server/${otherPage}`));
    if (port === "collections")
      for (const child of [
        "library-collections-screen-shared",
        "library-collections-list-view",
        "library-collections-detail-view",
        "library-collections-history-view",
        "library-collections-copy-view",
        "library-collections-item-transfer-view",
        "library-collections-error-panel",
      ])
        assert(modules.has(`site/src/features/library/server/${child}.tsx`), child);
    if (port === "membership-history")
      assert(modules.has("site/src/features/library/server/library-membership-history-item.tsx"));
    if (port === "selection-batch")
      assert(
        modules.has("site/src/features/library/components/library-selection-batch-controls.tsx"),
      );
    assert(![...modules].some((name) => name.startsWith("site/src/app/")));
  }
});

test("Library collection routes preserve dynamic rendering and server entry", () => {
  for (const route of [
    "",
    "/[id]",
    "/[id]/add",
    "/[id]/history",
    "/[id]/copy",
    "/[id]/copy-items",
    "/[id]/move-items",
  ]) {
    const source = readFileSync(
      resolve(root, `site/src/app/workspace/library/collections${route}/page.tsx`),
      "utf8",
    );
    assert.match(source, /export const dynamic = "force-dynamic";/u);
    assert(source.includes("features/library/collections-server"));
    assert.match(source, /export (?:const metadata|async function generateMetadata)/u);
  }
});

test("Library release routes preserve dynamic rendering and server entry", () => {
  for (const [route, port] of [
    ["[id]/versions/compare", "release-comparison"],
    ["version-history", "release-history"],
    ["collections/[id]/releases", "collection-releases"],
    ["collections/[id]/requirements", "collection-requirements"],
  ]) {
    const source = readFileSync(
      resolve(root, `site/src/app/workspace/library/${route}/page.tsx`),
      "utf8",
    );
    assert.match(source, /export const dynamic = "force-dynamic";/u);
    assert(source.includes(`features/library/${port}-server`));
    assert.match(source, /export (?:const metadata|async function generateMetadata)/u);
  }
});

test("Library private page routes preserve dynamic rendering and metadata", () => {
  for (const [route, port] of [
    ["collections/[id]/import", "collection-import-page"],
    ["collections/[id]/reconcile", "collection-reconcile-page"],
    ["collections/[id]/compare", "collection-compare-page"],
    ["collections/receipts/[id]", "collection-receipt-page"],
    ["collections/history", "collection-history-page"],
    ["collections/resources", "collection-inventory-page"],
    ["[id]/collections", "resource-collections-page"],
  ]) {
    const source = readFileSync(
      resolve(root, `site/src/app/workspace/library/${route}/page.tsx`),
      "utf8",
    );
    assert.match(source, /export const dynamic = "force-dynamic";/u);
    assert.match(source, /export\s*\{\s*default,\s*generateMetadata,?\s*\}\s*from/u);
    assert(source.includes(`/${port}-server";`));
  }
});
