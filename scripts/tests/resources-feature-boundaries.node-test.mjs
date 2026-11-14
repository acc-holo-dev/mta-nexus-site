import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("Resources feature rejects private imports, server leaks and impure model edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-resources-boundary-"));
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
  write("site/src/features/resources/components/card.ts", "export const card = 1;");
  write("site/src/features/resources/model/query.ts", 'export { domain } from "@nexus/domain";');
  write("site/src/features/resources/model.ts", 'export { domain } from "./model/query";');
  write(
    "site/src/features/resources/client.ts",
    '"use client"; export { card } from "./components/card"; export type { Session } from "../../lib/services/session";',
  );
  write(
    "site/src/features/resources/download.ts",
    '"use client"; export { page } from "./server";',
  );
  write(
    "site/src/features/resources/release-watch.ts",
    '"use client"; export { page } from "./server";',
  );
  write(
    "site/src/app/release-watch.ts",
    'export { page } from "../features/resources/release-watch";',
  );
  write("site/src/app/download.ts", 'export { page } from "../features/resources/download";');
  write(
    "site/src/features/resources/media-server.ts",
    'import "server-only"; export { page } from "./server";',
  );
  write(
    "site/src/app/media-route.ts",
    'export { page } from "../features/resources/media-server";',
  );
  write(
    "site/src/features/resources/components/media-server-leak.ts",
    'export { page } from "../media-server";',
  );
  write(
    "site/src/features/resources/build-server.ts",
    'import "server-only"; export { page } from "./server";',
  );
  write(
    "site/src/app/build-route.ts",
    'export { page } from "../features/resources/build-server";',
  );
  write(
    "site/src/features/resources/components/build-server-leak.ts",
    'export { page } from "../build-server";',
  );
  write("site/src/features/resources/evidence.ts", 'export { page } from "./server";');
  write("site/src/app/media.ts", 'export { card } from "../features/resources/client";');
  write("site/src/app/evidence.ts", 'export { page } from "../features/resources/evidence";');
  write("site/src/features/resources/detail-view.ts", 'export { page } from "./server";');
  write("site/src/app/detail-view.ts", 'export { page } from "../features/resources/detail-view";');
  write(
    "site/src/features/resources/review-controls.ts",
    '"use client"; export { page } from "./server";',
  );
  write(
    "site/src/app/review-controls.ts",
    'export { page } from "../features/resources/review-controls";',
  );
  for (const port of ["compatibility-controls", "variant-controls"]) {
    write(
      `site/src/features/resources/${port}.ts`,
      '"use client"; export { page } from "./server";',
    );
    write(`site/src/app/${port}.ts`, `export { page } from "../features/resources/${port}";`);
  }
  write("site/src/features/resources/reviews-view.ts", 'export { page } from "./server";');
  write(
    "site/src/app/reviews-view.ts",
    'export { page } from "../features/resources/reviews-view";',
  );
  write("site/src/features/resources/view.ts", 'export { card } from "./components/card";');
  write(
    "site/src/features/resources/server.ts",
    'import "server-only"; export { page } from "./server/page";',
  );
  write(
    "site/src/features/resources/server/page.ts",
    'import { db } from "../../../lib/services/session"; export const page = db;',
  );
  write(
    "site/src/features/resources/detail-server.ts",
    'import "server-only"; export { detail } from "./server/detail";',
  );
  write("site/src/features/resources/server/detail.ts", "export const detail = 1;");
  write("site/src/app/detail.ts", 'export { detail } from "../features/resources/detail-server";');
  write(
    "site/src/features/resources/components/detail-leak.ts",
    'export { detail } from "../detail-server";',
  );
  write(
    "site/src/app/detail-deep.ts",
    'export { detail } from "../features/resources/server/detail";',
  );
  for (const scenario of ["versions", "reviews"]) {
    write(
      `site/src/features/resources/${scenario}-server.ts`,
      `import "server-only"; export { value } from "./server/${scenario}"; export type Scope = string;`,
    );
    write(`site/src/features/resources/server/${scenario}.ts`, "export const value = 1;");
    write(
      `site/src/app/${scenario}.ts`,
      `export { value } from "../features/resources/${scenario}-server";`,
    );
    write(
      `site/src/app/${scenario}-deep.ts`,
      `export { value } from "../features/resources/server/${scenario}";`,
    );
    write(
      `site/src/features/resources/components/${scenario}-leak.ts`,
      scenario === "versions"
        ? `export type { Scope } from "../${scenario}-server";`
        : `export { value } from "../${scenario}-server";`,
    );
  }
  write("site/src/app/page.ts", 'export { page } from "../features/resources/server";');
  write("site/src/app/view.ts", 'export { card } from "../features/resources/view";');
  write("site/src/lib/consumer.ts", 'export { domain } from "../features/resources/model";');
  write("site/src/app/deep.ts", 'export { card } from "../features/resources/components/card";');
  write("site/src/features/other/deep.ts", 'export { domain } from "../resources/model/query";');
  write(
    "site/src/features/resources/components/server-leak.ts",
    'export { page } from "../server";',
  );
  write(
    "site/src/features/resources/components/service-leak.ts",
    'export type { Session } from "../../../lib/services/session";',
  );
  write(
    "site/src/features/resources/components/db-leak.ts",
    'export type { Row } from "@nexus/db";',
  );
  write("site/src/features/resources/model/ui-leak.ts", 'export type { View } from "@nexus/ui";');
  write("site/src/features/resources/model/framework-leak.ts", 'export { useState } from "react";');
  write(
    "site/src/features/resources/model/node-leak.ts",
    'export { readFileSync } from "node:fs";',
  );
  write(
    "site/src/features/resources/server/routing-leak.ts",
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
    ["features/resources/components/build-server-leak.ts", "resources-view-isolation"],
    ["features/resources/components/media-server-leak.ts", "resources-view-isolation"],
    ["features/resources/detail-view.ts", "resources-view-isolation"],
    ["features/resources/review-controls.ts", "resources-view-isolation"],
    ["features/resources/compatibility-controls.ts", "resources-view-isolation"],
    ["features/resources/variant-controls.ts", "resources-view-isolation"],
    ["features/resources/reviews-view.ts", "resources-view-isolation"],
    ["features/resources/client.ts", "resources-view-isolation"],
    ["features/resources/release-watch.ts", "resources-view-isolation"],
    ["features/resources/download.ts", "resources-view-isolation"],
    ["features/resources/evidence.ts", "resources-view-isolation"],
    ["app/versions-deep.ts", "resources-feature-public-api"],
    ["app/reviews-deep.ts", "resources-feature-public-api"],
    ["features/resources/components/versions-leak.ts", "resources-view-isolation"],
    ["features/resources/components/reviews-leak.ts", "resources-view-isolation"],
    ["app/detail-deep.ts", "resources-feature-public-api"],
    ["features/resources/components/detail-leak.ts", "resources-view-isolation"],
    ["app/deep.ts", "resources-feature-public-api"],
    ["features/other/deep.ts", "resources-feature-public-api"],
    ["features/resources/components/server-leak.ts", "resources-view-isolation"],
    ["features/resources/components/service-leak.ts", "resources-view-isolation"],
    ["features/resources/components/db-leak.ts", "resources-view-isolation"],
    ["features/resources/model/ui-leak.ts", "resources-model-is-pure"],
    ["features/resources/model/framework-leak.ts", "resources-model-has-no-framework"],
    ["features/resources/model/node-leak.ts", "resources-view-has-no-node-builtins"],
    ["features/resources/server/routing-leak.ts", "resources-feature-does-not-import-routing"],
  ])
    assert(rules(`site/src/${name}`).includes(rule), `${name} escaped ${rule}`);
  for (const name of [
    "app/detail-view.ts",
    "app/review-controls.ts",
    "app/compatibility-controls.ts",
    "app/variant-controls.ts",
    "app/reviews-view.ts",
    "app/build-route.ts",
    "app/media-route.ts",
    "app/media.ts",
    "app/release-watch.ts",
    "app/download.ts",
    "app/evidence.ts",
    "app/versions.ts",
    "app/reviews.ts",
    "app/detail.ts",
    "app/page.ts",
    "app/view.ts",
    "lib/consumer.ts",
    "features/resources/server/page.ts",
    "features/resources/model/query.ts",
  ])
    assert.deepEqual(rules(`site/src/${name}`), [], name);
  const gate = cruise(fixture, ["site/src", "site/packages"], "err");
  assert.notEqual(gate.status, 0, "Forbidden imports must fail the architecture gate");
  assert.match(`${gate.stdout}${gate.stderr}`, /resources-feature-public-api/u);
});

test("real client, evidence, view and model entrypoints have no transitive server dependencies", () => {
  const result = cruise(root, [
    "site/src/features/resources/release-watch.ts",
    "site/src/features/resources/compatibility-controls.ts",
    "site/src/features/resources/variant-controls.ts",
    "site/src/features/resources/components/build-moderation-controls.tsx",
    "site/src/features/resources/components/resource-build-controls.tsx",
    "site/src/features/resources/components/resource-media-editor.tsx",
    "site/src/features/resources/download.ts",
    "site/src/features/resources/client.ts",
    "site/src/features/resources/evidence.ts",
    "site/src/features/resources/detail-view.ts",
    "site/src/features/resources/components/reverse-dependency-list.tsx",
    "site/src/features/resources/components/resource-variant-choices.tsx",
    "site/src/features/resources/components/resource-version-help-section.tsx",
    "site/src/features/resources/review-controls.ts",
    "site/src/features/resources/reviews-view.ts",
    "site/src/features/resources/view.ts",
    "site/src/features/resources/model.ts",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const modules = new Map(graph.modules.map((module) => [module.source, module]));
  const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    assert(
      !/^site\/src\/(?:app\/|features\/resources\/(?:server|(?:detail|versions|reviews|media|build)-server)(?:\.ts$|\/)|lib\/(?:services\/|i18n-server\.ts$))/u.test(
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
  assert.match(
    readFileSync(resolve(root, "site/src/features/resources/client.ts"), "utf8"),
    /"use client"/u,
  );
  assert.match(
    readFileSync(resolve(root, "site/src/features/resources/download.ts"), "utf8"),
    /"use client"/u,
  );
  assert.match(
    readFileSync(resolve(root, "site/src/features/resources/release-watch.ts"), "utf8"),
    /"use client"/u,
  );
  visit("site/src/features/resources/release-watch.ts");
  visit("site/src/features/resources/compatibility-controls.ts");
  visit("site/src/features/resources/variant-controls.ts");
  visit("site/src/features/resources/components/build-moderation-controls.tsx");
  visit("site/src/features/resources/components/resource-build-controls.tsx");
  visit("site/src/features/resources/components/resource-media-editor.tsx");
  visit("site/src/features/resources/download.ts");
  visit("site/src/features/resources/client.ts");
  visit("site/src/features/resources/evidence.ts");
  visit("site/src/features/resources/detail-view.ts");
  visit("site/src/features/resources/components/reverse-dependency-list.tsx");
  visit("site/src/features/resources/components/resource-variant-choices.tsx");
  visit("site/src/features/resources/components/resource-version-help-section.tsx");
  visit("site/src/features/resources/review-controls.ts");
  visit("site/src/features/resources/reviews-view.ts");
  visit("site/src/features/resources/view.ts");
  visit("site/src/features/resources/model.ts");
  for (const file of [
    "components/resource-qa-report-form.tsx",
    "components/resource-review-controls.tsx",
    "components/resource-qa-panel.tsx",
    "components/resource-review-list.tsx",
    "components/resource-release-watch-control.tsx",
    "components/resource-download-button.tsx",
    "components/resource-preview.tsx",
    "components/resource-gallery-lightbox.tsx",
    "components/build-provenance-details.tsx",
    "components/build-package-evidence.tsx",
    "model/build-provenance.ts",
    "model/resource-gallery-interaction.ts",
  ])
    assert(visited.has(`site/src/features/resources/${file}`), file);
  assert(visited.has("site/src/features/resources/components/product-card.tsx"));
  assert(visited.has("site/src/features/resources/model/market-query.ts"));
});

test("Resources server entrypoints keep independent composition graphs", () => {
  const entries = [
    ["server.ts", "market-page.tsx"],
    ["detail-server.ts", "detail-page.tsx"],
    ["versions-server.ts", "versions-page.tsx"],
    ["reviews-server.ts", "reviews-page.tsx"],
    ["media-server.ts", "media-screen.tsx"],
    ["build-server.ts", "build-screen.tsx"],
  ];
  for (const [entry, ownPage] of entries) {
    const source = `site/src/features/resources/${entry}`;
    assert.match(readFileSync(resolve(root, source), "utf8"), /import "server-only"/u);
    const result = cruise(root, [source]);
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.equal(graph.summary.violations.length, 0, JSON.stringify(graph.summary.violations));
    const modules = new Set(graph.modules.map((module) => module.source));
    assert(modules.has(`site/src/features/resources/server/${ownPage}`), ownPage);
    for (const [otherEntry, otherPage] of entries) {
      if (otherEntry !== entry)
        assert(!modules.has(`site/src/features/resources/server/${otherPage}`), otherPage);
    }
    assert(![...modules].some((name) => name.startsWith("site/src/app/")));
  }
});
