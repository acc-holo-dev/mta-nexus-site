import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyTests, discoverTests } from "../test-projects.mjs";

const fixtures = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function project(files) {
  const root = mkdtempSync(path.join(tmpdir(), "nexus-test-projects-"));
  fixtures.push(root);
  for (const [name, source] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source);
  }
  return root;
}

const databaseFiles = {
  "packages/db/src/client.ts": 'import postgres from "postgres";',
  "packages/db/src/index.ts": 'export { db } from "./client";',
  "repository.ts": 'import { db } from "@nexus/db";',
};

describe("isolated and shared-database test projects", () => {
  it("serializes ordinary tests with direct and transitive live database imports", () => {
    const root = project({
      ...databaseFiles,
      "direct.test.ts": 'import { db } from "@nexus/db";',
      "indirect.test.ts": 'import repository from "./repository";',
      "logic.test.ts": 'import { expect } from "vitest";',
    });
    assert.deepEqual(classifyTests(root), {
      database: ["direct.test.ts", "indirect.test.ts"],
      unit: ["logic.test.ts"],
    });
  });

  it("allows fully mocked repositories in the parallel unit project", () => {
    const root = project({
      ...databaseFiles,
      "mock.test.ts": 'vi.mock("@nexus/db", () => ({ db: {} }));\nimport repo from "./repository";',
    });
    assert.deepEqual(classifyTests(root).unit, ["mock.test.ts"]);
  });

  it("finds multiple imports and barrel exports on the same line", () => {
    const root = project({
      ...databaseFiles,
      "inline.test.ts": 'import { it } from "vitest"; import { db } from "@nexus/db";',
      "barrel.ts": 'export { value } from "./logic"; export { db } from "@nexus/db";',
      "logic.ts": 'export const value = "pure";',
      "barrel.test.ts": 'import { db } from "./barrel";',
    });
    assert.deepEqual(classifyTests(root).database, ["barrel.test.ts", "inline.test.ts"]);
  });

  it("does not let commented, quoted or regex mock examples suppress database imports", () => {
    const root = project({
      ...databaseFiles,
      "line.test.ts":
        '// vi.mock("@nexus/db", () => ({ db: {} }));\nimport { db } from "@nexus/db";',
      "block.test.ts":
        '/* vi.mock("@nexus/db", () => ({ db: {} })); */\nimport { db } from "@nexus/db";',
      "quoted.test.ts":
        'const example = \'vi.mock("@nexus/db", () => ({ db: {} }));\';\nimport { db } from "@nexus/db";',
      "regex.test.ts":
        'const example = /vi.mock("@nexus\\/db", () => ({}))/;\nimport { db } from "@nexus/db";',
    });
    assert.deepEqual(classifyTests(root).database, [
      "block.test.ts",
      "line.test.ts",
      "quoted.test.ts",
      "regex.test.ts",
    ]);
  });

  it("restores the live edge when a full mock is subsequently removed", () => {
    const root = project({
      ...databaseFiles,
      "unmock.test.ts":
        'vi.mock("@nexus/db", () => ({ db: {} })); vi.unmock("@nexus/db"); import { db } from "@nexus/db";',
    });
    assert.deepEqual(classifyTests(root).database, ["unmock.test.ts"]);
  });

  it("serializes opaque dynamic imports inside template interpolations", () => {
    const root = project({
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal source fixture, evaluated only by the classifier.
      "template.test.ts": "const value = `value: ${await import(moduleName)}`;",
    });
    assert.deepEqual(classifyTests(root).database, ["template.test.ts"]);
  });

  it("keeps partial mocks and importActual in the database project", () => {
    const root = project({
      ...databaseFiles,
      "partial.test.ts":
        'vi.mock("@nexus/db", async (importOriginal) => ({ ...await importOriginal() }));\nimport repo from "./repository";',
      "actual.test.ts":
        'vi.mock("@nexus/db", () => ({ db: {} }));\nconst actual = await vi.importActual<typeof import("@nexus/db")>("@nexus/db");',
    });
    assert.deepEqual(classifyTests(root).database, ["actual.test.ts", "partial.test.ts"]);
  });

  it("does not execute type imports or paths inspected as source text", () => {
    const root = project({
      ...databaseFiles,
      "types.test.ts":
        'import type { db } from "@nexus/db";\nreadFileSync("packages/db/src/client.ts");',
    });
    assert.deepEqual(classifyTests(root).unit, ["types.test.ts"]);
  });

  it("serializes explicitly named integration tests and unknown dynamic imports", () => {
    const root = project({
      "future.integration.test.ts": "expect(true).toBe(true);",
      "dynamic.test.ts": "await import(moduleName);",
      "unknown.test.ts": 'import repository from "./not-yet-resolved";',
    });
    assert.deepEqual(classifyTests(root).database, [
      "dynamic.test.ts",
      "future.integration.test.ts",
      "unknown.test.ts",
    ]);
  });

  it("handles cyclic imports without recursion failures", () => {
    const root = project({
      ...databaseFiles,
      "a.ts": 'import b from "./b";',
      "b.ts": 'import a from "./a";\nimport { db } from "@nexus/db";',
      "cycle.test.ts": 'import a from "./a";',
    });
    assert.deepEqual(classifyTests(root).database, ["cycle.test.ts"]);
  });

  it("distinguishes TypeScript import queries from runtime imports", () => {
    const root = project({
      ...databaseFiles,
      "query.test.ts": 'type Repository = typeof import("@nexus/db");',
      "runtime.test.ts": 'const repository = (await import("@nexus/db")) as unknown;',
    });
    assert.deepEqual(classifyTests(root), {
      unit: ["query.test.ts"],
      database: ["runtime.test.ts"],
    });
  });

  it("follows actual template expressions without treating pure templates as database work", () => {
    const root = project({
      ...databaseFiles,
      "logic.ts": 'export const value = "pure";',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source fixtures for AST traversal.
      "pure.test.ts": 'const text = `value: ${await import("./logic")}`;',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: source fixtures for AST traversal.
      "live.test.ts": 'const text = `value: ${await import("@nexus/db")}`;',
    });
    assert.deepEqual(classifyTests(root), { unit: ["pure.test.ts"], database: ["live.test.ts"] });
  });

  it("supports typed dynamic mock targets without executing their import", () => {
    const root = project({
      ...databaseFiles,
      "typed.test.ts":
        'vi.mock(import("@nexus/db"), async () => ({ db: {} })); import repo from "./repository";',
    });
    assert.deepEqual(classifyTests(root).unit, ["typed.test.ts"]);
  });

  it("does not let a full mock hide a second partial mock or computed importActual", () => {
    const root = project({
      ...databaseFiles,
      "partial.test.ts":
        'vi.mock("@nexus/db", () => ({ db: {} })); vi.mock("@nexus/db", async (original) => ({ ...await original() })); import repo from "./repository";',
      "computed.test.ts":
        'vi.mock("@nexus/db", () => ({ db: {} })); const actual = await vi["importActual"]("@nexus/db");',
      "unmock.test.ts":
        'vi.mock("@nexus/db", () => ({ db: {} })); vi["unmock"]("@nexus/db"); import repo from "./repository";',
    });
    assert.deepEqual(classifyTests(root).database, [
      "computed.test.ts",
      "partial.test.ts",
      "unmock.test.ts",
    ]);
  });

  it("keeps automocks and non-hoisted mocks conservative", () => {
    const root = project({
      ...databaseFiles,
      "automatic.test.ts": 'vi.mock("@nexus/db"); import repo from "./repository";',
      "runtime.test.ts":
        'vi.doMock("@nexus/db", () => ({ db: {} })); import repo from "./repository";',
    });
    assert.deepEqual(classifyTests(root).database, ["automatic.test.ts", "runtime.test.ts"]);
  });

  it("follows CommonJS and TypeScript import-equals runtime edges", () => {
    const root = project({
      ...databaseFiles,
      "common.test.cjs": 'const repository = require("@nexus/db");',
      "equals.test.cts": 'import repository = require("@nexus/db");',
      "type.test.cts": 'import type repository = require("@nexus/db");',
      "mixed.test.ts": 'import { type db } from "@nexus/db";',
    });
    assert.deepEqual(classifyTests(root), {
      unit: ["type.test.cts"],
      database: ["common.test.cjs", "equals.test.cts", "mixed.test.ts"],
    });
  });

  it("fails with the source path when syntax cannot be parsed", () => {
    const root = project({ "broken.test.ts": 'import { db from "@nexus/db";' });
    assert.throws(() => classifyTests(root), /broken\.test\.ts/);
  });

  it("ignores generated test copies and includes every discovered test exactly once", () => {
    const root = project({
      "valid.test.ts": "",
      "valid.spec.tsx": "",
      ".next/standalone/copied.test.ts": "",
      "node_modules/dependency.test.ts": "",
      "dist/copied.test.ts": "",
    });
    const files = discoverTests(root);
    assert.deepEqual(files, ["valid.spec.tsx", "valid.test.ts"]);
    const groups = classifyTests(root);
    assert.deepEqual([...groups.unit, ...groups.database].sort(), files);
  });

  it("keeps all current repository tests and known shared queue suites", () => {
    const groups = classifyTests(process.cwd());
    assert.deepEqual([...groups.unit, ...groups.database].sort(), discoverTests(process.cwd()));
    assert.ok(groups.database.includes("packages/db/src/repositories/account-mail-worker.test.ts"));
    assert.ok(groups.database.includes("tests/password-change-transaction.test.ts"));
    assert.ok(groups.unit.includes("tests/market-catalog-sql.test.ts"));
  });
});
