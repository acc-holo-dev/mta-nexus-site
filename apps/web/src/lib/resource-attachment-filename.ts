import path from "node:path";

/** Keep download header values ASCII and inert even for legacy database rows. */
const SAFE_PART = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u;
const SAFE_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".lua"]);

function safePart(value: string, fallback: string, maximum: number): string {
  if (value.length <= maximum && SAFE_PART.test(value) && !value.includes("..")) return value;
  const replaced = value.replace(/[^a-zA-Z0-9._-]/gu, "_")
    .replace(/\.\.+/gu, "_")
    .replace(/^[^a-zA-Z0-9]+/u, "")
    .slice(0, maximum);
  return replaced && SAFE_PART.test(replaced) && !replaced.includes("..")
    ? replaced : fallback;
}

export function resourceAttachmentFileName(
  slug: string,
  version: string,
  originalFileName: string,
): string {
  const extension = path.extname(originalFileName).toLowerCase();
  const ext = SAFE_EXTENSIONS.has(extension) ? extension : ".zip";
  // Leave sufficient room for separators and the extension under 200 chars.
  const safeSlug = safePart(slug, "resource", 95);
  const safeVersion = safePart(version, "release", 90);
  return safeSlug + "-" + safeVersion + ext;
}
