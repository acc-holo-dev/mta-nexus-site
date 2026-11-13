import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

for (const [label, app, packages] of [
  ["legacy", "apps/web", "packages"],
  ["application moved", "site", "packages"],
  ["nested packages", "site", "site/packages"],
]) {
  test(`migration boundaries reject actual imports: ${label}`, (t) => {
    const fixture = mkdtempSync(join(tmpdir(), "nexus-migration-boundaries-"));
    t.after(() => rmSync(fixture, { recursive: true, force: true }));
    const write = (file, content) => {
      const target = join(fixture, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    };
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          module: "esnext",
          moduleResolution: "bundler",
          paths: {
            "@nexus/db": [`./${packages}/db/src/index.ts`],
            "@nexus/security": [`./${packages}/security/src/index.ts`],
            "@nexus/domain": [`./${packages}/domain/src/index.ts`],
            "@app/service": [`./${app}/src/lib/service.ts`],
          },
        },
      }),
    );
    write(`${app}/src/lib/service.ts`, "export const service = 1;");
    write(
      `${packages}/security/src/index.ts`,
      "export type Token = string; export const token = 1;",
    );
    write(`${packages}/domain/src/index.ts`, "export const domain = 1;");
    write(
      `${packages}/db/src/index.ts`,
      'export { domain } from "@nexus/domain"; export const db = 1;',
    );
    write(`${packages}/domain/src/infra.ts`, 'export type { Token } from "@nexus/security";');
    write(`${packages}/domain/src/app.ts`, 'export { service } from "@app/service";');
    write(`${packages}/ui/src/server.ts`, 'export { db } from "@nexus/db";');
    write(`${packages}/security/src/app.ts`, 'export { service } from "@app/service";');
    write(`${app}/src/app/api/new-command/route.ts`, 'export { db } from "@nexus/db";');
    write(`${app}/src/app/api/health/route.ts`, 'export { db } from "@nexus/db";');
    write(`${packages}/domain/src/cycle-a.ts`, 'export { b } from "./cycle-b";');
    write(`${packages}/domain/src/cycle-b.ts`, 'export { a } from "./cycle-a";');
    write(`${packages}/domain/src/unresolved.ts`, 'export { missing } from "./missing";');
    const command = [
      resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs"),
      "--config",
      resolve(root, ".dependency-cruiser.cjs"),
    ];
    const graphResult = spawnSync(
      process.execPath,
      [...command, "--output-type", "json", `${app}/src`, packages],
      { cwd: fixture, encoding: "utf8" },
    );
    assert.equal(graphResult.status, 0, graphResult.stderr);
    const graph = JSON.parse(graphResult.stdout);
    const rulesFor = (source) => {
      const module = graph.modules.find((entry) => entry.source === source);
      assert.ok(module, `Missing fixture ${source}`);
      return module.dependencies.flatMap(
        (dependency) => dependency.rules?.map((rule) => rule.name) ?? [],
      );
    };
    for (const [source, rule] of [
      [`${packages}/domain/src/infra.ts`, "domain-is-independent"],
      [`${packages}/domain/src/app.ts`, "domain-is-independent"],
      [`${packages}/ui/src/server.ts`, "ui-does-not-import-server-packages"],
      [`${packages}/security/src/app.ts`, "packages-do-not-import-apps"],
      [`${app}/src/app/api/new-command/route.ts`, "http-handlers-use-services-for-db"],
      [`${packages}/domain/src/cycle-a.ts`, "no-circular-dependencies"],
      [`${packages}/domain/src/unresolved.ts`, "no-unresolved-imports"],
    ])
      assert.ok(rulesFor(source).includes(rule), `${source} escaped ${rule}`);
    assert.deepEqual(
      rulesFor(`${app}/src/app/api/health/route.ts`),
      [],
      "Known health exception must remain narrow and valid",
    );
    assert.deepEqual(
      rulesFor(`${packages}/db/src/index.ts`),
      [],
      "Nested package→domain must remain allowed",
    );
    const gate = spawnSync(process.execPath, [...command, `${app}/src`, packages], {
      cwd: fixture,
      encoding: "utf8",
    });
    assert.notEqual(gate.status, 0, "Violations must fail the CLI gate");
  });
}
