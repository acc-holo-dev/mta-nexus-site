import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseSync } from "@swc/core";

const ignoredDirectories = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

/** Discover source tests only, never generated standalone copies. */
export function discoverTests(root) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !ignoredDirectories.has(entry.name))
        visit(path.join(directory, entry.name));
      else if (entry.isFile() && /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
        files.push(path.relative(root, path.join(directory, entry.name)).split(path.sep).join("/"));
      }
    }
  }
  visit(root);
  return files.sort();
}

/**
 * Follow executable imports to the real PostgreSQL client. Full vi.mock factories
 * cut an import edge; partial mocks/importActual retain it. Unknown dynamic
 * imports are conservative: they belong to the database project.
 */
export function classifyTests(root, files = discoverTests(root)) {
  const parsed = new Map();
  function resolveModule(owner, name) {
    const base = name.startsWith("@nexus/")
      ? path.join(
          root,
          "packages",
          name.slice(7).split("/")[0],
          "src",
          ...name.slice(7).split("/").slice(1),
        )
      : name.startsWith(".")
        ? path.resolve(path.dirname(owner), name)
        : null;
    if (!base) return null;
    return (
      [
        base,
        ...[
          ".ts",
          ".tsx",
          ".mts",
          ".cts",
          ".js",
          ".jsx",
          ".mjs",
          "/index.ts",
          "/index.tsx",
          "/index.js",
        ].map((extension) => base + extension),
      ].find((candidate) => existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate)) ?? null
    );
  }
  function inspect(file) {
    if (parsed.has(file)) return parsed.get(file);
    let ast;
    try {
      ast = parseSync(readFileSync(file, "utf8"), {
        syntax: /\.[cm]?tsx?$/.test(file) ? "typescript" : "ecmascript",
        tsx: file.endsWith(".tsx"),
        jsx: file.endsWith(".jsx"),
        decorators: true,
      });
    } catch (cause) {
      throw new Error(`Cannot classify test imports in ${path.relative(root, file)}`, { cause });
    }
    const imports = [];
    const mocks = new Set();
    const actual = new Set();
    let unknownImport = false;
    const literal = (node) => (node?.type === "StringLiteral" ? node.value : null);
    const importCall = (node) =>
      node?.type === "CallExpression" &&
      (node.callee.type === "Import" ||
        (node.callee.type === "Identifier" && node.callee.value === "require"));
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const child of node) visit(child);
        return;
      }
      // Type queries such as typeof import("@nexus/db") never execute.
      if (node.type === "TsImportType") return;
      if (node.type === "TsImportEqualsDeclaration") {
        if (!node.isTypeOnly && node.moduleRef.type === "TsExternalModuleReference")
          imports.push(node.moduleRef.expression.value);
        return;
      }
      if (
        ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type)
      ) {
        if (node.source && !node.typeOnly) imports.push(node.source.value);
        return;
      }
      if (importCall(node)) {
        const name = literal(node.arguments[0]?.expression);
        if (name === null) unknownImport = true;
        else imports.push(name);
      }
      const callee = node.type === "CallExpression" ? node.callee : null;
      if (
        callee?.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.value === "vi"
      ) {
        const method =
          callee.property.type === "Identifier"
            ? callee.property.value
            : literal(callee.property.expression);
        if (method === null) unknownImport = true;
        if (["mock", "doMock", "importActual", "unmock", "doUnmock"].includes(method)) {
          const argument = node.arguments[0]?.expression;
          // Vitest strips the dynamic import in vi.mock(import("..."), factory).
          const name =
            method === "mock" &&
            argument?.type === "CallExpression" &&
            argument.callee.type === "Import"
              ? literal(argument.arguments[0]?.expression)
              : literal(argument);
          const target = name === null ? null : resolveModule(file, name);
          if (name === null) unknownImport = true;
          const factory = node.arguments[1]?.expression;
          if (
            method === "mock" &&
            factory?.type === "ArrowFunctionExpression" &&
            factory.params.length === 0
          ) {
            if (target) mocks.add(target);
          } else {
            // Partial/automatic/runtime mocks cannot prove the original module
            // is never evaluated. A later full mock must not erase this edge.
            if (target) actual.add(target);
            if (name !== null && ["importActual", "mock", "doMock"].includes(method))
              imports.push(name);
          }
          // Walk factories (including importActual) but not the stripped target.
          for (const argument of node.arguments.slice(1)) visit(argument.expression);
          return;
        }
      }
      for (const child of Object.values(node)) visit(child);
    }
    visit(ast);
    for (const target of actual) mocks.delete(target);
    const result = { imports, mocks, unknownImport };
    parsed.set(file, result);
    return result;
  }
  const database = [];
  const unit = [];
  for (const relative of files) {
    const entry = path.resolve(root, relative);
    const mocks = inspect(entry).mocks;
    const seen = new Set();
    function usesDatabase(file) {
      if (seen.has(file)) return false;
      seen.add(file);
      if (file === path.join(root, "packages/db/src/client.ts")) return true;
      const info = inspect(file);
      if (info.unknownImport || info.imports.includes("postgres")) return true;
      return info.imports.some((name) => {
        const target = resolveModule(file, name);
        // Unresolved workspace imports cannot be proven independent of the DB.
        if (!target) return name.startsWith(".") || name.startsWith("@nexus/");
        return !mocks.has(target) && usesDatabase(target);
      });
    }
    // Explicit integration files stay serialized even if their current imports
    // are mocked: the naming contract promises a real integration environment.
    (/\.integration\./.test(relative) || usesDatabase(entry) ? database : unit).push(relative);
  }
  return { unit, database };
}
