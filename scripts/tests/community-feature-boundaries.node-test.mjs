import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const ports = [
  "discussion",
  "topic-form",
  "report-form",
  "own-discussion",
  "article-view",
  "publication-feed",
  "author-content-form",
  "author-publication-restore",
  "catalog-controls",
  "reactions",
  "reaction-removal",
  "content-moderation",
  "object-mute-controls",
  "follow",
  "report-evidence-links",
];
const utilPorts = ["discussion-mutation-confirmation", "follow-confirmation"];
const safeLib =
  /^(?:i18n(?:\.ts$|\/)|(?:community-report-contract|community-report-copy|user-platform-copy|private-api-request|user-platform-client|user-platform-contract|community-topic-intent|community-topic-submission|content-comment-client|content-comment-confirmation|content-discussion-copy|content-discussion-contract|discussion-compose-draft|discussion-workspace-copy|follow-workspace-copy|follow-workspace-contract|community-report-groups-copy|community-report-history-copy|discussion-reports-copy|community-report-groups-contract|community-report-history-contract|private-change-history-query|private-change-history-copy|community-moderation-contract|community-moderation-copy|moderated-discussion-contract|moderated-discussion-copy|discussion-reports-contract|report-batch-contract|report-batch-copy|discussion-workspace-contract|publication-feed-contract|publication-feed-copy|author-publication-desk-copy|author-publication-desk-contract|organization-content-copy|server-content-copy|support-workspace-contract|organization-publication-history-contract|organization-publication-history-copy|server-publication-history-contract|server-publication-history-copy|admin-action-confirmation|content-reaction-contract|content-reaction-copy)\.ts$)/u;
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

test("Community rejects private imports, routing, server and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-community-boundary-"));
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
  write("site/src/features/community/components/private.ts", "export const value = 1;");
  write("site/src/features/community/server.ts", "export const page = 1;");
  for (const port of [...ports, ...utilPorts]) {
    write(
      `site/src/features/community/${port}.ts`,
      '"use client"; export { page } from "./server";',
    );
    write(`site/src/app/${port}.ts`, `export { page } from "../features/community/${port}";`);
  }
  write(
    "site/src/app/deep.ts",
    'export { value } from "../features/community/components/private";',
  );
  write(
    "site/src/features/community/components/service.ts",
    'export type { Row } from "../../../lib/services/session";',
  );
  write("site/src/features/community/components/db.ts", 'export type { Row } from "@nexus/db";');
  write(
    "site/src/features/community/components/node.ts",
    'export { readFileSync } from "node:fs";',
  );
  write(
    "site/src/features/community/components/route.ts",
    'export { value } from "../../../app/deep";',
  );
  for (const port of [
    "reports",
    "report-history",
    "report-groups",
    "moderation",
    "moderated-discussion",
    "discussion-reports",
    "publication-reports",
    "publication-feed-loading",
    "context-history",
    "community-page",
    "new-topic-page",
    "articles-page",
    "article-page",
    "own-discussions-page",
    "own-discussion-page",
    "author-desk-page",
    "author-create-page",
    "author-edit-page",
    "author-history-page",
    "following-feed-page",
  ]) {
    write(`site/src/features/community/${port}-server.ts`, "export const value = 1;");
    write(
      `site/src/app/${port}-server.ts`,
      `export { value } from "../features/community/${port}-server";`,
    );
    write(
      `site/src/features/community/components/${port}-leak.ts`,
      `export { value } from "../${port}-server";`,
    );
  }
  const result = cruise(fixture, ["site/src", "site/packages"]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const rules = (name) => {
    const module = graph.modules.find((item) => item.source === `site/src/${name}`);
    assert(module, name);
    return module.dependencies.flatMap((edge) => edge.rules?.map((rule) => rule.name) || []);
  };
  for (const port of [...ports, ...utilPorts]) {
    assert(rules(`features/community/${port}.ts`).includes("community-client-isolation"), port);
    assert.deepEqual(rules(`app/${port}.ts`), []);
  }
  for (const port of [
    "reports",
    "report-history",
    "report-groups",
    "moderation",
    "moderated-discussion",
    "discussion-reports",
    "publication-reports",
    "publication-feed-loading",
    "context-history",
    "community-page",
    "new-topic-page",
    "articles-page",
    "article-page",
    "own-discussions-page",
    "own-discussion-page",
    "author-desk-page",
    "author-create-page",
    "author-edit-page",
    "author-history-page",
    "following-feed-page",
  ]) {
    assert.deepEqual(rules(`app/${port}-server.ts`), []);
    assert(
      rules(`features/community/components/${port}-leak.ts`).includes("community-client-isolation"),
    );
  }
  for (const [name, rule] of [
    ["app/deep.ts", "community-feature-public-api"],
    ["features/community/components/service.ts", "community-client-isolation"],
    ["features/community/components/db.ts", "community-client-isolation"],
    ["features/community/components/node.ts", "community-client-has-no-node-builtins"],
    ["features/community/components/route.ts", "community-feature-does-not-import-routing"],
  ])
    assert(rules(name).includes(rule), `${name} escaped ${rule}`);
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

test("real Community client graphs have no transitive server dependencies", () => {
  const entries = [...ports, ...utilPorts].map((port) => `site/src/features/community/${port}.ts`);
  const componentEntries = [
    "community-report-detail",
    "community-report-list",
    "community-report-history",
    "community-report-groups",
    "moderated-discussion-removal",
    "discussion-report-batch",
    "content-comment-form",
    "reaction-removal",
  ].map((name) => `site/src/features/community/components/${name}.tsx`);
  const result = cruise(root, [...entries, ...componentEntries]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const modules = new Map(graph.modules.map((module) => [module.source, module]));
  const visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    assert(
      !/^site\/src\/(?:app\/|features\/community\/(?:server(?:\.ts$|\/)|(?:reports|report-history|report-groups|moderation|moderated-discussion|discussion-reports|publication-reports|publication-feed-loading|context-history|community-page|new-topic-page|articles-page|article-page|own-discussions-page|own-discussion-page|author-desk-page|author-create-page|author-edit-page|author-history-page|following-feed-page)-server\.ts$))/u.test(
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
    const portName = entry.split("/").pop().replace(/\.ts$/u, "");
    if (
      !utilPortSet.has(portName) &&
      !["article-view", "publication-feed", "report-evidence-links"].some((port) =>
        entry.endsWith(`/${port}.ts`),
      )
    )
      assert.match(readFileSync(resolve(root, entry), "utf8"), /^"use client";/u);
    visit(entry);
  }
  for (const entry of componentEntries) visit(entry);
  for (const name of [
    "community-report-detail",
    "community-report-list",
    "moderated-discussion-removal",
    "discussion-report-batch",
  ])
    assert.match(
      readFileSync(resolve(root, `site/src/features/community/components/${name}.tsx`), "utf8"),
      /^"use client";/u,
    );
  assert(
    visited.has("site/src/features/community/components/content-discussion-compose-feedback.tsx"),
  );
});

test("Community report server entrypoints have isolated composition graphs", () => {
  const entries = [
    ["reports-server.ts", "community-report-screen.tsx"],
    ["report-history-server.ts", "community-report-history-page.tsx"],
    ["report-groups-server.ts", "community-report-groups-page.tsx"],
    ["moderation-server.ts", "community-moderation-screen.tsx"],
    ["moderated-discussion-server.ts", "moderated-discussion-screen.tsx"],
    ["discussion-reports-server.ts", "discussion-reports-screen.tsx"],
    ["publication-reports-server.ts", "publication-reports-page.tsx"],
    ["publication-feed-loading-server.ts", "publication-feed-loading.tsx"],
    ["context-history-server.ts", "context-publication-history-screen.tsx"],
    ["community-page-server.ts", "community-page.tsx"],
    ["new-topic-page-server.ts", "new-topic-page.tsx"],
    ["articles-page-server.ts", "articles-page.tsx"],
    ["article-page-server.ts", "article-page.tsx"],
    ["own-discussions-page-server.ts", "own-discussions-page.tsx"],
    ["own-discussion-page-server.ts", "own-discussion-page.tsx"],
    ["author-desk-page-server.ts", "author-desk-page.tsx"],
    ["author-create-page-server.ts", "author-create-page.tsx"],
    ["author-edit-page-server.ts", "author-edit-page.tsx"],
    ["author-history-page-server.ts", "author-history-page.tsx"],
    ["following-feed-page-server.ts", "following-feed-page.tsx"],
  ];
  for (const [entry, ownPage] of entries) {
    const source = `site/src/features/community/${entry}`;
    assert.match(readFileSync(resolve(root, source), "utf8"), /import "server-only"/u);
    const result = cruise(root, [source]);
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.equal(graph.summary.violations.length, 0, JSON.stringify(graph.summary.violations));
    const modules = new Set(graph.modules.map((module) => module.source));
    assert(modules.has(`site/src/features/community/server/${ownPage}`), ownPage);
    for (const [otherEntry, otherPage] of entries)
      if (otherEntry !== entry)
        assert(!modules.has(`site/src/features/community/server/${otherPage}`), otherPage);
    assert(![...modules].some((name) => name.startsWith("site/src/app/")));
  }
});

test("Community routes retain dynamic rendering and metadata contracts", () => {
  for (const [route, port, dynamic, metadata] of [
    ["community", "community-page", true, true],
    ["community/new", "new-topic-page", false, false],
    ["articles", "articles-page", true, true],
    ["articles/[slug]", "article-page", true, true],
    ["workspace/discussions", "own-discussions-page", true, true],
    ["workspace/discussions/[id]", "own-discussion-page", true, true],
    ["workspace/content", "author-desk-page", true, true],
    ["workspace/content/new", "author-create-page", true, true],
    ["workspace/content/[id]", "author-edit-page", true, true],
    ["workspace/content/[id]/history", "author-history-page", true, true],
    ["workspace/feed", "following-feed-page", true, true],
  ]) {
    const source = readFileSync(resolve(root, `site/src/app/${route}/page.tsx`), "utf8");
    assert.equal(source.includes('export const dynamic = "force-dynamic";'), dynamic);
    assert.equal(source.includes("generateMetadata"), metadata);
    assert(source.includes(`/${port}-server";`));
  }
});
