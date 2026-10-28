import path from "node:path";
import { isAllowedResourceUploadExtension } from "@nexus/domain";

/** Keep download header values ASCII and inert even for legacy database rows. */
const SAFE_PART = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u;

function safePart(value: string, fallback: string, maximum: number): string {
  if (value.length <= maximum && SAFE_PART.test(value) && !value.includes("..")) return value;
  const replaced = value
    .replace(/[^a-zA-Z0-9._-]/gu, "_")
    .replace(/\.\.+/gu, "_")
    .replace(/^[^a-zA-Z0-9]+/u, "")
    .slice(0, maximum);
  return replaced && SAFE_PART.test(replaced) && !replaced.includes("..") ? replaced : fallback;
}

export function resourceAttachmentFileName(
  slug: string,
  version: string,
  originalFileName: string,
): string {
  const extension = path.extname(originalFileName).toLowerCase();
  const ext = isAllowedResourceUploadExtension(extension) ? extension : ".zip";
  // Leave sufficient room for separators and the extension under 200 chars.
  const safeSlug = safePart(slug, "resource", 95);
  const safeVersion = safePart(version, "release", 90);
  return safeSlug + "-" + safeVersion + ext;
}

/**
 * Reviewer filenames contain identifiers supplied by legacy rows. Neither
 * the DB build ID nor the original filename may control HTTP header syntax.
 * Handle Windows and POSIX separators regardless of the deployment OS.
 */
export function reviewerAttachmentFileName(buildId: string, originalFileName: string): string {
  const safeId = safePart(buildId, "build", 64);
  const base = path.win32.basename(path.posix.basename(originalFileName));
  const safeName = safePart(base, "artifact.bin", 100);
  return `review-${safeId}-${safeName}`;
}
