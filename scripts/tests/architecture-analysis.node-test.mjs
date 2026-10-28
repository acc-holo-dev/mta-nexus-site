import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");

test("architecture analysis detects type dependencies and cycles", () => {
  const fixture = mkdtempSync(join(tmpdir(), "nexus-architecture-"));
  const write = (file, content) => {
    const path = join(fixture, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  try {
    write(
      "tsconfig.json",
      JSON.stringify({
        compilerOptions: {
          module: "esnext",
          moduleResolution: "bundler",
          paths: { "@nexus/security": ["./packages/security/src/index.ts"] },
        },
      }),
    );
    write(
      "packages/security/src/index.ts",
      'export type Token = string; export const token = "x";',
    );
    write(
      "packages/domain/src/value.ts",
      'import { token } from "@nexus/security"; export { token };',
    );
    write(
      "packages/domain/src/type.ts",
      'import type { Token } from "@nexus/security"; export type T = Token;',
    );
    write(
      "packages/domain/src/type-expression.ts",
      'export type T = import("@nexus/security").Token;',
    );
    write("packages/domain/src/type-export.ts", 'export type { Token } from "@nexus/security";');
    write("packages/domain/src/cycle-a.ts", 'export { b } from "./cycle-b";');
    write("packages/domain/src/cycle-b.ts", 'export { a } from "./cycle-a";');

    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs"),
        "--config",
        resolve(root, ".dependency-cruiser.cjs"),
        "--output-type",
        "json",
        "packages",
      ],
      { cwd: fixture, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const gate = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs"),
        "--config",
        resolve(root, ".dependency-cruiser.cjs"),
        "packages",
      ],
      { cwd: fixture, encoding: "utf8" },
    );
    assert.notEqual(gate.status, 0, "The architecture gate must fail for violations");
    assert.match(`${gate.stdout}${gate.stderr}`, /domain-is-independent/u);
    const graph = JSON.parse(result.stdout);
    for (const file of ["value", "type", "type-expression", "type-export"]) {
      const module = graph.modules.find((item) => item.source === `packages/domain/src/${file}.ts`);
      assert.ok(module, `Missing ${file} fixture`);
      const edge = module.dependencies.find(
        (item) => item.resolved === "packages/security/src/index.ts",
      );
      assert.ok(
        edge?.rules?.some((rule) => rule.name === "domain-is-independent"),
        `${file} dependency missed`,
      );
    }
    assert.ok(
      graph.modules.some((module) =>
        module.dependencies.some((edge) =>
          edge.rules?.some((rule) => rule.name === "no-circular-dependencies"),
        ),
      ),
      "Circular dependency missed",
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
