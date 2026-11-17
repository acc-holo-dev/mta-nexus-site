import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const cruiser = resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const config = resolve(root, ".dependency-cruiser.cjs");
const features = [
  {
    name: "support",
    clients: ["center", "thread", "download-help"],
    privateClients: ["support-case-actions", "support-status-history", "support-message-browser"],
    servers: [
      ["page-server", "support-page.tsx"],
      ["messages-server", "support-message-page.tsx"],
    ],
    safe: "support-response|support-retry|private-api-request|support-workspace-contract|support-workspace-copy|user-platform-client|user-platform-contract|user-platform-copy|support-message-discovery-copy|support-message-discovery-contract|private-change-history-query",
  },
  {
    name: "moderation",
    clients: [
      "object-report",
      "report-controls",
      "verification-workspace",
      "verification-amend",
      "verification-controls",
      "admin-status-labels",
      "verification-moderation",
    ],
    clientUtilPorts: ["admin-status-labels", "verification-moderation"],
    privateClients: [],
    servers: [["reports-server", "platform-reports-screen.tsx"]],
    safe: "platform-report-i18n|private-api-request|admin-action-confirmation|community-report-copy|order-case-i18n|resource-review-i18n|storage-maintenance-i18n|user-platform-copy|user-platform-client|user-platform-contract|verification-applications-contract|content-discussion-contract|verification-workspace-contract|verification-applications-copy|verification-workspace-copy",
  },
  {
    name: "accounts",
    clients: [
      "auth",
      "controls",
      "settings",
      "context",
      "profile",
      "change-history",
      "profile-change-history",
      "profile-pagination",
      "developer-experience",
      "ad-preference",
    ],
    privateClients: [
      "settings-active-sessions",
      "settings-password-form",
      "settings-recovery-email-section",
      "settings-advertising-preferences-section",
    ],
    servers: [],
    clientUtilPorts: ["profile-pagination", "developer-experience", "ad-preference"],
    safe: "notification-preferences-confirmation|notification-inbox-copy|feature-flags|profile-privacy-copy|profile-privacy-contract|settings-client-api|private-change-history-copy|private-change-history-query|profile-change-history-contract|user-platform-client|private-api-request|user-platform-contract|user-platform-copy|verification-workspace-contract|verification-workspace-copy",
  },
  {
    name: "shell",
    clients: [
      "shell",
      "navbar",
      "footer",
      "sidebar",
      "locale",
      "session",
      "auth-session",
      "auth-return",
      "guest-auth",
      "session-error",
      "home-personal",
      "modal-dialog",
      "pwa-service-worker",
      "legal-document",
      "copyable-plain-code-block",
      "confirm-action",
      "action-confirm-checkbox",
      "theme-preference",
      "home-personal-preference",
    ],
    clientUtilPorts: [
      "auth-return",
      "session-error",
      "home-personal",
      "legal-document",
      "theme-preference",
      "home-personal-preference",
    ],
    privateClients: ["shell-session-unavailable"],
    servers: [],
    safe: "managed-server-view|managed-server-copy|publication-feed-copy|organization-workspace-copy|organization-batch-copy|user-platform-copy|community-report-copy|content-reaction-copy|content-discussion-copy|discussion-workspace-copy|platform-report-i18n|verification-workspace-copy|license-maintenance-i18n|notification-copy|notification-inbox-copy|notification-inbox-events|private-api-request|resource-release-watches-i18n|visible-polling|home-personal-changes-types",
  },
  {
    name: "discovery",
    clients: [],
    privateClients: [],
    servers: [["directory-server", "discovery-directory.tsx"]],
    safe: "",
  },
];
function cruise(cwd, entries, output = "json") {
  return spawnSync(
    process.execPath,
    [cruiser, "--config", config, "--output-type", output, ...entries],
    { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
}

test("Remaining features reject private, routing, server and infrastructure edges", (t) => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-remaining-boundaries-"));
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
  for (const { name, clients, servers } of features) {
    write(`site/src/features/${name}/components/private.ts`, "export const value = 1;");
    write(`site/src/features/${name}/server/page.ts`, "export const value = 1;");
    write(
      `site/src/app/${name}-private.ts`,
      `export { value } from "../features/${name}/components/private";`,
    );
    write(
      `site/src/features/${name}/components/route.ts`,
      `export { value } from "../../../app/${name}-private";`,
    );
    for (const port of clients) {
      write(`site/src/features/${name}/${port}.ts`, 'export { value } from "./server/page";');
      write(
        `site/src/app/${name}-${port}.ts`,
        `export { value } from "../features/${name}/${port}";`,
      );
    }
    for (const [port] of servers) {
      write(`site/src/features/${name}/${port}.ts`, 'export { value } from "./server/page";');
      write(
        `site/src/app/${name}-${port}.ts`,
        `export { value } from "../features/${name}/${port}";`,
      );
      if (clients.length)
        write(
          `site/src/features/${name}/components/${port}-leak.ts`,
          `export { value } from "../${port}";`,
        );
    }
    if (clients.length) {
      write(
        `site/src/features/${name}/components/service.ts`,
        'export type { Row } from "../../../lib/services/session";',
      );
      write(`site/src/features/${name}/components/db.ts`, 'export type { Row } from "@nexus/db";');
      write(
        `site/src/features/${name}/components/node.ts`,
        'export { readFileSync } from "node:fs";',
      );
    }
  }
  const result = cruise(fixture, ["site/src", "site/packages"]);
  assert.equal(result.status, 0, result.stderr);
  const graph = JSON.parse(result.stdout);
  const rules = (name) => {
    const mod = graph.modules.find((item) => item.source === `site/src/${name}`);
    assert(mod, name);
    return mod.dependencies.flatMap((edge) => edge.rules?.map((rule) => rule.name) || []);
  };
  for (const { name, clients, servers } of features) {
    assert(rules(`app/${name}-private.ts`).includes(`${name}-feature-public-api`));
    assert(
      rules(`features/${name}/components/route.ts`).includes(
        `${name}-feature-does-not-import-routing`,
      ),
    );
    for (const port of clients) {
      assert(rules(`features/${name}/${port}.ts`).includes(`${name}-client-isolation`));
      assert.deepEqual(rules(`app/${name}-${port}.ts`), []);
    }
    for (const [port] of servers) {
      assert.deepEqual(rules(`app/${name}-${port}.ts`), []);
      if (clients.length)
        assert(
          rules(`features/${name}/components/${port}-leak.ts`).includes(`${name}-client-isolation`),
        );
    }
    if (clients.length)
      for (const [file, rule] of [
        ["service", "client-isolation"],
        ["db", "client-isolation"],
        ["node", "client-has-no-node-builtins"],
      ])
        assert(rules(`features/${name}/components/${file}.ts`).includes(`${name}-${rule}`));
  }
  assert.notEqual(cruise(fixture, ["site/src", "site/packages"], "err").status, 0);
});

for (const { name, clients, privateClients, servers, safe, clientUtilPorts } of features) {
  if (clients.length)
    test(`${name} client graphs exclude server dependencies transitively`, () => {
      const ports = clients.map((port) => `site/src/features/${name}/${port}.ts`);
      const entries = [
        ...ports,
        ...privateClients.map((child) => `site/src/features/${name}/components/${child}.tsx`),
      ];
      const result = cruise(root, entries);
      assert.equal(result.status, 0, result.stderr);
      const graph = JSON.parse(result.stdout);
      assert.deepEqual(graph.summary.violations, []);
      const modules = new Map(graph.modules.map((mod) => [mod.source, mod]));
      const visited = new Set();
      const safeLib = new RegExp(`^(?:i18n(?:\\.ts$|/)|(?:${safe})\\.ts$)`, "u");
      function visit(path) {
        if (visited.has(path)) return;
        visited.add(path);
        assert(!path.startsWith("site/src/app/"), path);
        assert(!path.startsWith(`site/src/features/${name}/server/`), path);
        assert(!servers.some(([port]) => path === `site/src/features/${name}/${port}.ts`), path);
        assert(!/^site\/packages\/(?:db|storage|security|config)\//u.test(path), path);
        if (path.startsWith("site/src/lib/"))
          assert(safeLib.test(path.slice("site/src/lib/".length)), path);
        for (const edge of modules.get(path)?.dependencies || []) {
          assert(!edge.couldNotResolve, `${path} → ${edge.module}`);
          assert(!edge.dependencyTypes?.includes("core"), `${path} → ${edge.resolved}`);
          assert(!/server-only|next\/headers/u.test(edge.resolved), edge.resolved);
          visit(edge.resolved);
        }
      }
      const utilPorts = new Set(clientUtilPorts ?? []);
      for (const portPath of ports) {
        const portName = portPath.split("/").pop().replace(/\.ts$/u, "");
        if (utilPorts.has(portName)) continue;
        assert.match(readFileSync(resolve(root, portPath), "utf8"), /^"use client";/u);
      }
      for (const entry of entries) visit(entry);
    });
  if (servers.length)
    test(`${name} server entries stay server-only and avoid routing`, () => {
      for (const [port, page] of servers) {
        const source = `site/src/features/${name}/${port}.ts`;
        assert.match(readFileSync(resolve(root, source), "utf8"), /import "server-only"/u);
        const result = cruise(root, [source]);
        assert.equal(result.status, 0, result.stderr);
        const graph = JSON.parse(result.stdout);
        assert.deepEqual(graph.summary.violations, []);
        const modules = new Set(graph.modules.map((mod) => mod.source));
        assert(modules.has(`site/src/features/${name}/server/${page}`), page);
        for (const [other, otherPage] of servers)
          if (other !== port)
            assert(!modules.has(`site/src/features/${name}/server/${otherPage}`), otherPage);
        assert(![...modules].some((path) => path.startsWith("site/src/app/")));
      }
    });
}
