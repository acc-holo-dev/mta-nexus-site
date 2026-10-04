import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ignoredDirectories = new Set(["node_modules", ".next", ".git", "dist", "coverage"]);

/** Discover source tests only, never generated standalone copies. */
export function discoverTests(root) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) visit(path.join(directory, entry.name));
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
      ? path.join(root, "packages", name.slice(7).split("/")[0], "src", ...name.slice(7).split("/").slice(1))
      : name.startsWith(".") ? path.resolve(path.dirname(owner), name) : null;
    if (!base) return null;
    return [base, ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", "/index.ts", "/index.tsx", "/index.js"].map((extension) => base + extension)]
      .find((candidate) => existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate)) ?? null;
  }
  function inspect(file) {
    if (parsed.has(file)) return parsed.get(file);
    const source = readFileSync(file, "utf8");
    const imports = [];
    const mocks = new Set();
    // Static module statements only: quoted paths in source-contract assertions
    // and readFileSync calls are not executable dependencies.
    const statements = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:(?:[\s\S]*?)\s+from\s+)?["']([^"']+)["']/g;
    for (const match of source.matchAll(statements)) {
      if (/\{\s*type\s+[^}]+\}/.test(match[0]) && !/\{[^}]*,\s*(?!type\b)[A-Za-z_$]/.test(match[0])) continue;
      imports.push(match[1]);
    }
    const dynamicImports = /\b(?:import|require|vi\.importActual)\s*\(\s*(["'])([^"']+)\1\s*\)/g;
    for (const match of source.matchAll(dynamicImports)) imports.push(match[2]);
    const unknownImport = /\b(?:import|require)\s*\(\s*(?!["'\s])/.test(source);
    const fullMocks = /\bvi\.mock\s*\(\s*(["'])([^"']+)\1\s*,\s*(?:async\s+)?\(\s*\)\s*=>/g;
    for (const match of source.matchAll(fullMocks)) {
      const target = resolveModule(file, match[2]);
      if (target) mocks.add(target);
    }
    // importActual is an escape from the mock barrier, including generic calls.
    for (const match of source.matchAll(/\bvi\.importActual(?:<[^;]+?>)?\s*\(\s*(["'])([^"']+)\1/g)) {
      imports.push(match[2]);
      const target = resolveModule(file, match[2]);
      if (target) mocks.delete(target);
    }
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
