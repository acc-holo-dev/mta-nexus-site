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
  // Tokenize enough JavaScript/TypeScript syntax to distinguish executable
  // imports and mocks from comments, assertion strings and regex literals.
  function tokenize(source) {
    const tokens = [];
    let unknownTemplateImport = false;
    let index = 0;
    while (index < source.length) {
      const character = source[index];
      if (/\s/.test(character)) { index++; continue; }
      if (source.startsWith("//", index)) {
        const end = source.indexOf("\n", index + 2);
        index = end === -1 ? source.length : end + 1;
        continue;
      }
      if (source.startsWith("/*", index)) {
        const end = source.indexOf("*/", index + 2);
        index = end === -1 ? source.length : end + 2;
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        const quote = character;
        const start = ++index;
        let content = "";
        while (index < source.length && source[index] !== quote) {
          if (source[index] === "\\") { content += source.slice(index, index + 2); index += 2; }
          else content += source[index++];
        }
        index++;
        if (quote === "`") {
          // Interpolations need a full parser. Never assume their imports are
          // isolated just because template text is opaque to this scanner.
          if (content.includes("${") && /\b(?:import|require)\s*\(|\bvi\.importActual/.test(content)) unknownTemplateImport = true;
          tokens.push({ text: "template", value: content, start });
        } else tokens.push({ text: "string", value: content, start });
        continue;
      }
      const previous = tokens.at(-1)?.text;
      if (character === "/" && (!previous || ["=", "(", ",", ":", "[", "!", "return", "=>", "|", "&", "?"].includes(previous))) {
        // A regex is opaque too; its quotes and comment-like text are data.
        index++;
        let bracket = false;
        while (index < source.length) {
          if (source[index] === "\\") { index += 2; continue; }
          if (source[index] === "[") bracket = true;
          if (source[index] === "]") bracket = false;
          if (source[index] === "/" && !bracket) { index++; break; }
          index++;
        }
        while (/[a-z]/i.test(source[index] ?? "")) index++;
        tokens.push({ text: "regex" });
        continue;
      }
      const identifier = /^[A-Za-z_$][\w$]*/.exec(source.slice(index));
      if (identifier) {
        tokens.push({ text: identifier[0] });
        index += identifier[0].length;
      } else if (source.startsWith("=>", index)) {
        tokens.push({ text: "=>" }); index += 2;
      } else { tokens.push({ text: character }); index++; }
    }
    return { tokens, unknownTemplateImport };
  }
  function inspect(file) {
    if (parsed.has(file)) return parsed.get(file);
    const { tokens, unknownTemplateImport } = tokenize(readFileSync(file, "utf8"));
    const imports = [];
    const mocks = new Set();
    const actual = new Set();
    let unknownImport = unknownTemplateImport;
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index].text;
      const next = tokens[index + 1];
      if ((token === "import" || token === "export") && next?.text !== "type" && next?.text !== "(") {
        if (token === "import" && next?.text === "string") imports.push(next.value);
        else {
          for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].text !== ";"; cursor++) {
            if (tokens[cursor].text === "from" && tokens[cursor + 1]?.text === "string") {
              imports.push(tokens[cursor + 1].value);
              break;
            }
          }
        }
      }
      if ((token === "import" || token === "require") && next?.text === "(") {
        const argument = tokens[index + 2];
        if (argument?.text === "string") imports.push(argument.value);
        else unknownImport = true;
      }
      if (token !== "vi" || next?.text !== ".") continue;
      const method = tokens[index + 2]?.text;
      let cursor = index + 3;
      if (tokens[cursor]?.text === "<") {
        let depth = 0;
        do {
          if (tokens[cursor]?.text === "<") depth++;
          if (tokens[cursor]?.text === ">") depth--;
          cursor++;
        } while (cursor < tokens.length && depth > 0);
      }
      if (tokens[cursor]?.text !== "(") continue;
      const argument = tokens[cursor + 1];
      if (argument?.text !== "string") {
        if (["mock", "importActual", "unmock", "doUnmock"].includes(method)) unknownImport = true;
        continue;
      }
      const target = resolveModule(file, argument.value);
      if (method === "importActual") {
        imports.push(argument.value);
        if (target) actual.add(target);
      } else if (method === "unmock" || method === "doUnmock") {
        if (target) actual.add(target);
      } else if (method === "mock" && tokens[cursor + 2]?.text === ",") {
        let factory = cursor + 3;
        if (tokens[factory]?.text === "async") factory++;
        if (tokens[factory]?.text === "(" && tokens[factory + 1]?.text === ")" && tokens[factory + 2]?.text === "=>" && target) mocks.add(target);
      }
    }
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
