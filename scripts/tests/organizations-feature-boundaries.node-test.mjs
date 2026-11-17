import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const utilPorts = [
  "organization-member-confirmation",
  "organization-workspace-client",
  "organization-team-copy",
  "organization-governance-copy",
  "organization-batch-copy",
  "organization-content-copy",
  "organization-publication-history-copy",
  "organization-workspace-copy",
];
const clientPorts = ["workspace", "team", "profile", "history-view"];
const serverPorts = [
  "content-editor",
  "publication-history",
  "directory-page",
  "workspace-page",
  "team-page",
  "activity-page",
  "content-page",
  "public-directory",
  "public-profile",
  "public-activity",
  "public-trust",
];
const safeLib =
  /^(?:i18n(?:\.ts$|\/)|(?:organization-governance-contract|organization-workspace-contract|user-platform-contract|private-change-history-query|user-platform-copy|private-change-history-copy|user-platform-client|private-api-request|organization-team-contract|content-discussion-contract|organization-batch-contract)\.ts$)/u;
function cruise(cwd, entries, output = "json") {
  return spawnSync(
    process.execPath,
    [cruiser, "--config", config, "--output-type", output, ...entries],
    { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
}

test("Organizations rejects private, routing, server and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-organizations-boundary-"));
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
  write("site/src/features/organizations/components/private.ts", "export const value = 1;");
  write("site/src/features/organizations/server/page.ts", "export const value = 1;");
  for (const port of [...clientPorts, ...utilPorts]) {
    write(`site/src/features/organizations/${port}.ts`, 'export { value } from "./server/page";');
    write(`site/src/app/${port}.ts`, `export { value } from "../features/organizations/${port}";`);
  }
  for (const port of serverPorts) {
    write(
      `site/src/features/organizations/${port}-server.ts`,
      'export { value } from "./server/page";',
    );
    write(
      `site/src/app/${port}-server.ts`,
      `export { value } from "../features/organizations/${port}-server";`,
    );
    write(
      `site/src/features/organizations/components/${port}-leak.ts`,
      `export { value } from "../${port}-server";`,
    );
  }
  write(
    "site/src/app/deep.ts",
    'export { value } from "../features/organizations/components/private";',
  );
  write(
    "site/src/features/organizations/components/service.ts",
    'export type { Row } from "../../../lib/services/session";',
  );
  write(
    "site/src/features/organizations/components/db.ts",
    'export type { Row } from "@nexus/db";',
  );
  write(
    "site/src/features/organizations/components/node.ts",
    'export { readFileSync } from "node:fs";',
  );
  write(
    "site/src/features/organizations/components/route.ts",
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
    assert(
      rules(`features/organizations/${port}.ts`).includes("organizations-client-isolation"),
      port,
    );
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const port of serverPorts) {
    assert.deepEqual(rules(`app/${port}-server.ts`), []);
    assert(
      rules(`features/organizations/components/${port}-leak.ts`).includes(
        "organizations-client-isolation",
      ),
    );
  }
  for (const [name, rule] of [
    ["app/deep.ts", "organizations-feature-public-api"],
    ["features/organizations/components/service.ts", "organizations-client-isolation"],
    ["features/organizations/components/db.ts", "organizations-client-isolation"],
    ["features/organizations/components/node.ts", "organizations-client-has-no-node-builtins"],
    ["features/organizations/components/route.ts", "organizations-feature-does-not-import-routing"],
  ])
    assert(rules(name).includes(rule), `${name}: ${rule}`);
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

test("Organizations client graphs exclude server dependencies transitively", () => {
  const entries = [...clientPorts, ...utilPorts].map(
    (port) => `site/src/features/organizations/${port}.ts`,
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
      !/^site\/src\/(?:app\/|features\/organizations\/(?:server\/|(?:content-editor|publication-history|directory-page|workspace-page|team-page|activity-page|content-page|public-directory|public-profile|public-activity|public-trust)-server\.ts$))/u.test(
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
    if (!entry.endsWith("/history-view.ts")) {
      const portName = entry.split("/").pop().replace(/\.ts$/u, "");
      if (!utilPortSet.has(portName))
        assert.match(readFileSync(resolve(root, entry), "utf8"), /^"use client";/u);
    }
    visit(entry);
  }
  for (const child of [
    "organization-member-editor",
    "organization-team-batch",
    "organization-ownership-transfer",
  ])
    assert(visited.has(`site/src/features/organizations/components/${child}.tsx`), child);
});

test("Organizations server entries stay server-only and separately composed", () => {
  const entries = [
    ["content-editor", "organization-content-editor-page.tsx"],
    ["publication-history", "organization-publication-history-screen.tsx"],
    ["directory-page", "directory-page.tsx"],
    ["workspace-page", "workspace-page.tsx"],
    ["team-page", "team-page.tsx"],
    ["activity-page", "activity-page.tsx"],
    ["content-page", "content-page.tsx"],
    ["public-directory", "public-directory.tsx"],
    ["public-profile", "public-profile.tsx"],
    ["public-activity", "public-activity.tsx"],
    ["public-trust", "public-trust.tsx"],
  ];
  for (const [port, page] of entries) {
    const source = `site/src/features/organizations/${port}-server.ts`;
    assert.match(readFileSync(resolve(root, source), "utf8"), /import "server-only"/u);
    const result = cruise(root, [source]);
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.deepEqual(graph.summary.violations, []);
    const modules = new Set(graph.modules.map((mod) => mod.source));
    assert(modules.has(`site/src/features/organizations/server/${page}`));
    for (const [otherPort, otherPage] of entries)
      if (otherPort !== port)
        assert(!modules.has(`site/src/features/organizations/server/${otherPage}`));
    assert(![...modules].some((name) => name.startsWith("site/src/app/")));
  }
});

test("Organizations route entries retain dynamic rendering and metadata", () => {
  for (const [route, port] of [
    ["workspace/organizations", "directory-page"],
    ["workspace/organizations/[id]", "workspace-page"],
    ["workspace/organizations/[id]/team", "team-page"],
    ["workspace/organizations/[id]/activity", "activity-page"],
    ["workspace/organizations/[id]/content", "content-page"],
    ["organizations", "public-directory"],
    ["organizations/[slug]", "public-profile"],
    ["organizations/[slug]/activity", "public-activity"],
    ["organizations/[slug]/trust", "public-trust"],
  ]) {
    const source = readFileSync(resolve(root, `site/src/app/${route}/page.tsx`), "utf8");
    assert.match(source, /export const dynamic = "force-dynamic";/u);
    assert.match(source, /export\s*\{\s*default,\s*generateMetadata,?\s*\}\s*from/u);
    assert(source.includes(`/${port}-server";`));
  }
});
