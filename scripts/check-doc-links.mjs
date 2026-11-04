import { existsSync, readdirSync, readFileSync } from "node:fs";
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

// A closing fence must use the opening character and be at least as long.
// Shorter or differently marked fences are literal content in the code block.
function fenceAfter(line, fence) {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
  if (!match) return fence;
  const marker = match[1];
  if (fence) {
    return marker[0] === fence[0] && marker.length >= fence.length && /^\s*$/u.test(match[2])
      ? null
      : fence;
  }
  if (marker[0] === "`" && match[2].includes("`")) return null;
  return marker;
}

function headings(source) {
  const counts = new Map();
  const ids = new Set();
  let fence = null;
  for (const line of source.split("\n")) {
    const nextFence = fenceAfter(line, fence);
    if (fence || nextFence) {
      fence = nextFence;
      continue;
    }
    const match = /^#{1,6}\s+(.+?)\s*#*\s*$/u.exec(line);
    if (!match) continue;
    const slug = match[1]
      .toLowerCase()
      .replace(/<[^>]+>/gu, "")
      .replace(/[^\p{L}\p{N}_\- ]/gu, "")
      .trim()
      .replace(/ /gu, "-");
    let count = counts.get(slug) ?? 0;
    let id = count ? `${slug}-${count}` : slug;
    while (ids.has(id)) {
      count++;
      id = `${slug}-${count}`;
    }
    counts.set(slug, count + 1);
    ids.add(id);
  }
  return ids;
}

export function checkLinks(files) {
  const errors = [];
  let checked = 0;
  const cache = new Map();
  for (const file of files) {
    let fence = null;
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const nextFence = fenceAfter(lines[i], fence);
      if (fence || nextFence) {
        fence = nextFence;
        continue;
      }
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
