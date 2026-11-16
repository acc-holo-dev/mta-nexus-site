import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
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

test("Servers pilot rejects private imports, server leaks and impure model edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-servers-boundary-"));
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
        paths: {
          "@nexus/domain": ["./site/packages/domain/src/index.ts"],
          "@nexus/db": ["./site/packages/db/src/index.ts"],
          "@nexus/ui": ["./site/packages/ui/src/index.ts"],
        },
      },
    }),
  );
  write("node_modules/server-only/package.json", '{"name":"server-only","main":"index.js"}');
  write("node_modules/server-only/index.js", "export {};");
  write("node_modules/react/package.json", '{"name":"react","main":"index.js"}');
  write("node_modules/react/index.js", "export const useState = 1;");
  write("site/packages/domain/src/index.ts", "export const domain = 1;");
  write("site/packages/db/src/index.ts", "export const db = 1; export type Row = string;");
  write("site/packages/ui/src/index.ts", "export type View = string;");
  write(
    "site/src/lib/services/session.ts",
    'export { db } from "@nexus/db"; export type Session = string;',
  );
  write("site/src/features/servers/components/card.ts", "export const card = 1;");
  write(
    "site/src/features/servers/model/observation.ts",
    'export { domain } from "@nexus/domain";',
  );
  write("site/src/features/servers/model.ts", 'export { domain } from "./model/observation";');
  for (const port of [
    "connect",
    "statistics-export",
    "statistics-view",
    "registration",
    "claim-controls",
    "details-controls",
    "workspace-navigation",
    "review-controls",
    "follow",
    "visibility-batch",
  ]) {
    write(`site/src/features/servers/${port}.ts`, 'export { page } from "./server";');
    write(`site/src/app/${port}.ts`, `export { page } from "../features/servers/${port}";`);
  }
  write("site/src/features/servers/client.ts", 'export { card } from "./components/card";');
  write(
    "site/src/features/servers/server.ts",
    'import "server-only"; export { page } from "./server/page";',
  );
  write(
    "site/src/features/servers/server/page.ts",
    'import { db } from "../../../lib/services/session"; export const page = db;',
  );
  for (const port of [
    "statistics",
    "observations",
    "history",
    "claim-status",
    "managed-card",
    "content-editor",
    "activity",
    "publication-history",
    "updates",
  ]) {
    write(
      `site/src/features/servers/${port}-server.ts`,
      'import "server-only"; export { page } from "./server/page";',
    );
    write(
      `site/src/app/${port}-server.ts`,
      `export { page } from "../features/servers/${port}-server";`,
    );
    write(
      `site/src/features/servers/components/${port}-leak.ts`,
      `export { page } from "../${port}-server";`,
    );
  }
  write("site/src/app/page.ts", 'export { page } from "../features/servers/server";');
  write("site/src/app/client.ts", 'export { card } from "../features/servers/client";');
  write("site/src/lib/consumer.ts", 'export { domain } from "../features/servers/model";');
  write("site/src/app/deep.ts", 'export { card } from "../features/servers/components/card";');
  write(
    "site/src/features/other/deep.ts",
    'export { domain } from "../servers/model/observation";',
  );
  write("site/src/features/servers/components/server-leak.ts", 'export { page } from "../server";');
  write(
    "site/src/features/servers/components/service-leak.ts",
    'export type { Session } from "../../../lib/services/session";',
  );
  write("site/src/features/servers/components/db-leak.ts", 'export type { Row } from "@nexus/db";');
  write("site/src/features/servers/model/ui-leak.ts", 'export type { View } from "@nexus/ui";');
  write("site/src/features/servers/model/framework-leak.ts", 'export { useState } from "react";');
  write("site/src/features/servers/model/node-leak.ts", 'export { readFileSync } from "node:fs";');
  write(
    "site/src/features/servers/server/routing-leak.ts",
    'export { page } from "../../../app/page";',
  );

  const result = cruise(fixture, ["site/src", "site/packages"]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const rules = (name) => {
    const module = graph.modules.find((item) => item.source === name);
    assert(module, name);
    return module.dependencies.flatMap((edge) => edge.rules?.map((rule) => rule.name) || []);
  };
  for (const [name, rule] of [
    ["features/servers/review-controls.ts", "servers-client-isolation"],
    ["features/servers/follow.ts", "servers-client-isolation"],
    ["features/servers/visibility-batch.ts", "servers-client-isolation"],
    ["features/servers/workspace-navigation.ts", "servers-client-isolation"],
    ["features/servers/registration.ts", "servers-client-isolation"],
    ["features/servers/claim-controls.ts", "servers-client-isolation"],
    ["features/servers/details-controls.ts", "servers-client-isolation"],
    ["features/servers/connect.ts", "servers-client-isolation"],
    ["features/servers/statistics-export.ts", "servers-client-isolation"],
    ["features/servers/statistics-view.ts", "servers-client-isolation"],
    ["features/servers/components/content-editor-leak.ts", "servers-client-isolation"],
    ["features/servers/components/activity-leak.ts", "servers-client-isolation"],
    ["features/servers/components/publication-history-leak.ts", "servers-client-isolation"],
    ["features/servers/components/updates-leak.ts", "servers-client-isolation"],
    ["features/servers/components/claim-status-leak.ts", "servers-client-isolation"],
    ["features/servers/components/managed-card-leak.ts", "servers-client-isolation"],
    ["features/servers/components/statistics-leak.ts", "servers-client-isolation"],
    ["features/servers/components/observations-leak.ts", "servers-client-isolation"],
    ["features/servers/components/history-leak.ts", "servers-client-isolation"],
    ["app/deep.ts", "servers-feature-public-api"],
    ["features/other/deep.ts", "servers-feature-public-api"],
    ["features/servers/components/server-leak.ts", "servers-client-isolation"],
    ["features/servers/components/service-leak.ts", "servers-client-isolation"],
    ["features/servers/components/db-leak.ts", "servers-client-isolation"],
    ["features/servers/model/ui-leak.ts", "servers-model-is-pure"],
    ["features/servers/model/framework-leak.ts", "servers-model-has-no-framework"],
    ["features/servers/model/node-leak.ts", "servers-client-has-no-node-builtins"],
    ["features/servers/server/routing-leak.ts", "servers-feature-does-not-import-routing"],
  ])
    assert(rules(`site/src/${name}`).includes(rule), `${name} escaped ${rule}`);
  for (const name of [
    "app/content-editor-server.ts",
    "app/activity-server.ts",
    "app/publication-history-server.ts",
    "app/updates-server.ts",
    "app/claim-status-server.ts",
    "app/managed-card-server.ts",
    "app/statistics-server.ts",
    "app/observations-server.ts",
    "app/history-server.ts",
    "app/page.ts",
    "app/review-controls.ts",
    "app/follow.ts",
    "app/visibility-batch.ts",
    "app/workspace-navigation.ts",
    "app/registration.ts",
    "app/claim-controls.ts",
    "app/details-controls.ts",
    "app/connect.ts",
    "app/statistics-export.ts",
    "app/statistics-view.ts",
    "app/client.ts",
    "lib/consumer.ts",
    "features/servers/server/page.ts",
    "features/servers/model/observation.ts",
  ])
    assert.deepEqual(rules(`site/src/${name}`), [], name);
  const gate = cruise(fixture, ["site/src", "site/packages"], "err");
  assert.notEqual(gate.status, 0, "Forbidden imports must fail the architecture gate");
  assert.match(`${gate.stdout}${gate.stderr}`, /servers-feature-public-api/u);
});

test("real client and model entrypoints have no transitive server dependencies", () => {
  const result = cruise(root, [
    "site/src/features/servers/review-controls.ts",
    "site/src/features/servers/follow.ts",
    "site/src/features/servers/visibility-batch.ts",
    "site/src/features/servers/workspace-navigation.ts",
    "site/src/features/servers/registration.ts",
    "site/src/features/servers/claim-controls.ts",
    "site/src/features/servers/details-controls.ts",
    "site/src/features/servers/connect.ts",
    "site/src/features/servers/statistics-export.ts",
    "site/src/features/servers/statistics-view.ts",
    "site/src/features/servers/client.ts",
    "site/src/features/servers/model.ts",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const modules = new Map(graph.modules.map((module) => [module.source, module]));
  const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    assert(
      !/^site\/src\/(?:app\/|features\/servers\/(?:server(?:\.ts$|\/)|(?:statistics|observations|history|claim-status|managed-card|content-editor|activity|publication-history|updates)-server\.ts$)|lib\/(?!(?:i18n(?:\.ts$|\/)|(?:private-api-request|server-history-window|server-statistics-contract|server-statistics-copy|server-statistics-download|server-claim-confirmation|server-claim-status-view|server-mutation-confirmation|server-mutation-errors|server-organization-options|server-workspace-nav-i18n|managed-server-copy|server-workspace-contract|server-workspace-copy|user-platform-client|user-platform-copy|user-platform-contract|follow-initial-state|follow-confirmation|follow-workspace-contract|follow-workspace-copy|content-discussion-contract|server-review-confirmation|server-review-i18n)\.ts$)))/u.test(
        name,
      ),
      name,
    );
    assert(!/^site\/packages\/(?:db|storage|security|config)\//u.test(name), name);
    for (const dependency of modules.get(name)?.dependencies || []) {
      assert(!dependency.couldNotResolve, `${name} → ${dependency.module}`);
      assert(!dependency.dependencyTypes?.includes("core"), `${name} → ${dependency.resolved}`);
      assert(!/server-only|next\/headers/u.test(dependency.resolved), dependency.resolved);
      visit(dependency.resolved);
    }
  }
  for (const port of [
    "connect",
    "statistics-export",
    "registration",
    "claim-controls",
    "details-controls",
    "workspace-navigation",
    "review-controls",
    "follow",
    "visibility-batch",
  ]) {
    assert.match(
      readFileSync(resolve(root, `site/src/features/servers/${port}.ts`), "utf8"),
      /^"use client";/u,
    );
  }
  assert.doesNotMatch(
    readFileSync(resolve(root, "site/src/features/servers/statistics-view.ts"), "utf8"),
    /^"use client";/u,
  );
  visit("site/src/features/servers/review-controls.ts");
  visit("site/src/features/servers/follow.ts");
  visit("site/src/features/servers/visibility-batch.ts");
  visit("site/src/features/servers/workspace-navigation.ts");
  visit("site/src/features/servers/registration.ts");
  visit("site/src/features/servers/claim-controls.ts");
  visit("site/src/features/servers/details-controls.ts");
  visit("site/src/features/servers/connect.ts");
  visit("site/src/features/servers/statistics-export.ts");
  visit("site/src/features/servers/statistics-view.ts");
  visit("site/src/features/servers/client.ts");
  visit("site/src/features/servers/model.ts");
  assert(visited.has("site/src/features/servers/components/server-card.tsx"));
  assert(visited.has("site/src/features/servers/model/mta-directory-page.ts"));
});

test("Servers server entrypoints keep independent composition graphs", () => {
  const entries = [
    ["server.ts", "servers-page.tsx"],
    ["statistics-server.ts", "server-statistics-page.tsx"],
    ["observations-server.ts", "server-observation-browser-page.tsx"],
    ["history-server.ts", "server-history-panel.tsx"],
    ["claim-status-server.ts", "server-claim-status-panel.tsx"],
    ["managed-card-server.ts", "managed-server-card.tsx"],
    ["content-editor-server.ts", "server-content-editor-page.tsx"],
    ["activity-server.ts", "server-workspace-history-screen.tsx"],
    ["publication-history-server.ts", "server-publication-history-screen.tsx"],
    ["updates-server.ts", "server-updates-panel.tsx"],
  ];
  for (const [entry, ownPage] of entries) {
    const source = `site/src/features/servers/${entry}`;
    assert.match(readFileSync(resolve(root, source), "utf8"), /import "server-only"/u);
    const result = cruise(root, [source]);
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.equal(graph.summary.violations.length, 0, JSON.stringify(graph.summary.violations));
    const modules = new Set(graph.modules.map((module) => module.source));
    assert(modules.has(`site/src/features/servers/server/${ownPage}`), ownPage);
    for (const [otherEntry, otherPage] of entries)
      if (otherEntry !== entry)
        assert(!modules.has(`site/src/features/servers/server/${otherPage}`), otherPage);
    assert(![...modules].some((name) => name.startsWith("site/src/app/")));
  }
});
