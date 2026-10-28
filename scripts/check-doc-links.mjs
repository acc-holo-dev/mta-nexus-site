import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory()
      ? markdownFiles(path)
      : entry.isFile() && path.endsWith(".md")
        ? [path]
        : [];
  });
}

function headings(source) {
  const counts = new Map();
  const ids = new Set();
  let fenced = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/u.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = /^#{1,6}\s+(.+?)\s*#*\s*$/u.exec(line);
    if (!match) continue;
    const slug = match[1]
      .toLowerCase()
      .replace(/<[^>]+>/gu, "")
      .replace(/[^\p{L}\p{N}_\- ]/gu, "")
      .trim()
      .replace(/ /gu, "-");
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    ids.add(count ? `${slug}-${count}` : slug);
  }
  return ids;
}

export function checkLinks(files) {
  const errors = [];
  let checked = 0;
  const cache = new Map();
  for (const file of files) {
    let fenced = false;
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*(```|~~~)/u.test(lines[i])) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      for (const match of lines[i].matchAll(/(?<!!)\[[^\]]+\]\(([^\s)]+)(?:\s+[^)]*)?\)/gu)) {
        const target = match[1].replace(/^<|>$/gu, "");
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/iu.test(target)) continue;
        const [rawPath, rawFragment] = target.split("#", 2);
        let path;
        let fragment;
        try {
          path = rawPath ? resolve(dirname(file), decodeURIComponent(rawPath.split("?")[0])) : file;
          fragment = rawFragment ? decodeURIComponent(rawFragment).toLowerCase() : "";
        } catch {
          errors.push(`${file}:${i + 1}: invalid link ${target}`);
          continue;
        }
        checked++;
        if (!existsSync(path)) {
          errors.push(`${file}:${i + 1}: missing ${target}`);
          continue;
        }
        if (fragment && extname(path) === ".md") {
          if (!cache.has(path)) cache.set(path, headings(readFileSync(path, "utf8")));
          if (!cache.get(path).has(fragment))
            errors.push(`${file}:${i + 1}: missing heading ${target}`);
        }
      }
    }
  }
  return { checked, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const files = [
    resolve(root, "README.md"),
    resolve(root, "AGENTS.md"),
    ...markdownFiles(resolve(root, "docs")),
  ];
  const { checked, errors } = checkLinks(files);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(`Checked ${checked} local Markdown links and headings in ${files.length} files.`);
}
