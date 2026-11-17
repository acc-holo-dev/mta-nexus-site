import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const clientPorts = ["bell", "preferences"];
const utilPorts = [
  "notification-inbox-events",
  "visible-polling",
  "notification-inbox-export-client",
  "notification-inbox-copy",
  "notification-read",
  "notification-preferences-confirmation",
  "notification-copy",
  "notification-inbox-contract",
];
const serverPorts = ["center"];
const safeLib =
  /^(?:(?:i18n(?:\.ts$|\/)|platform\/i18n\.ts$)|(?:notification-copy|license-maintenance-i18n|resource-release-watches-i18n|http\/private-api-request|content-discussion-contract)\.ts$)/u;
function cruise(cwd, entries, output = "json") {
  return spawnSync(
    process.execPath,
    [cruiser, "--config", config, "--output-type", output, ...entries],
    { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
}

test("Notifications rejects private, routing, server and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-notifications-boundary-"));
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
  write("site/src/features/notifications/components/private.ts", "export const value = 1;");
  write("site/src/features/notifications/server/page.ts", "export const value = 1;");
  for (const port of [...clientPorts, ...utilPorts]) {
    write(`site/src/features/notifications/${port}.ts`, 'export { value } from "./server/page";');
    write(`site/src/app/${port}.ts`, `export { value } from "../features/notifications/${port}";`);
  }
  for (const port of serverPorts) {
    write(
      `site/src/features/notifications/${port}-server.ts`,
      'export { value } from "./server/page";',
    );
    write(
      `site/src/app/${port}-server.ts`,
      `export { value } from "../features/notifications/${port}-server";`,
    );
    write(
      `site/src/features/notifications/components/${port}-leak.ts`,
      `export { value } from "../${port}-server";`,
    );
  }
  write(
    "site/src/app/deep.ts",
    'export { value } from "../features/notifications/components/private";',
  );
  write(
    "site/src/features/notifications/components/service.ts",
    'export type { Row } from "../../../lib/services/session";',
  );
  write(
    "site/src/features/notifications/components/db.ts",
    'export type { Row } from "@nexus/db";',
  );
  write(
    "site/src/features/notifications/components/node.ts",
    'export { readFileSync } from "node:fs";',
  );
  write(
    "site/src/features/notifications/components/route.ts",
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
      rules(`features/notifications/${port}.ts`).includes("notifications-client-isolation"),
      port,
    );
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const port of serverPorts) {
    assert.deepEqual(rules(`app/${port}-server.ts`), []);
    assert(
      rules(`features/notifications/components/${port}-leak.ts`).includes(
        "notifications-client-isolation",
      ),
    );
  }
  for (const [name, rule] of [
    ["app/deep.ts", "notifications-feature-public-api"],
    ["features/notifications/components/service.ts", "notifications-client-isolation"],
    ["features/notifications/components/db.ts", "notifications-client-isolation"],
    ["features/notifications/components/node.ts", "notifications-client-has-no-node-builtins"],
    ["features/notifications/components/route.ts", "notifications-feature-does-not-import-routing"],
  ])
    assert(rules(name).includes(rule), `${name}: ${rule}`);
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

test("Notifications client graphs exclude server dependencies transitively", () => {
  const entries = [...clientPorts, ...utilPorts].map(
    (port) => `site/src/features/notifications/${port}.ts`,
  );
  entries.push(
    ...["notification-inbox", "notification-center-tabs", "web-push-settings"].map(
      (name) => `site/src/features/notifications/components/${name}.tsx`,
    ),
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
      !/^site\/src\/(?:app\/|features\/notifications\/(?:server\/|center-server\.ts$))/u.test(name),
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
    "notification-bell",
    "settings-notification-preferences-section",
    "notification-inbox",
    "notification-center-tabs",
    "web-push-settings",
  ])
    assert(visited.has(`site/src/features/notifications/components/${child}.tsx`), child);
});

test("Notifications server entries stay server-only and separately composed", () => {
  const entries = [["center", "center-page.tsx"]];
  for (const [port, page] of entries) {
    const source = `site/src/features/notifications/${port}-server.ts`;
    assert.match(readFileSync(resolve(root, source), "utf8"), /import "server-only"/u);
    const result = cruise(root, [source]);
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.deepEqual(graph.summary.violations, []);
    const modules = new Set(graph.modules.map((mod) => mod.source));
    assert(modules.has(`site/src/features/notifications/server/${page}`));
    for (const [otherPort, otherPage] of entries)
      if (otherPort !== port)
        assert(!modules.has(`site/src/features/notifications/server/${otherPage}`));
    assert(![...modules].some((name) => name.startsWith("site/src/app/")));
  }
});

test("Notifications route retains dynamic rendering and metadata", () => {
  const source = readFileSync(resolve(root, "site/src/app/notifications/page.tsx"), "utf8");
  assert.match(source, /export const dynamic = "force-dynamic";/u);
  assert.match(source, /export\s*\{\s*default,\s*generateMetadata,?\s*\}\s*from/u);
  assert(source.includes('/center-server";'));
});
