export const AUTHOR_RESOURCE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DRAFT_LENGTH = 100_000;

export interface AuthorDetailsDraft {
  title: string;
  shortDescription: string;
  description: string;
  tagsText: string;
}
export interface AuthorVersionDraft {
  version: string;
  mtaVersionTarget: string;
  releaseNotes: string;
}
export interface AuthorResourceDraft {
  schemaVersion: 1;
  actorId: string;
  productId: string;
  savedAt: number;
  baseUpdatedAt: string;
  details: AuthorDetailsDraft;
  version: AuthorVersionDraft;
}
export const emptyAuthorVersion: AuthorVersionDraft = {
  version: "", mtaVersionTarget: "", releaseNotes: "",
};

export function authorResourceDraftKey(actorId: string, productId: string) {
  return `nexus:author-resource-draft:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(productId)}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function bounded(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

export function parseAuthorResourceDraft(
  raw: string | null,
  scope: { actorId: string; productId: string },
  now = Date.now(),
): AuthorResourceDraft | null {
  if (!raw || raw.length > MAX_DRAFT_LENGTH) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.schemaVersion !== 1 ||
      value.actorId !== scope.actorId || value.productId !== scope.productId ||
      typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt) ||
      value.savedAt > now || now - value.savedAt >= AUTHOR_RESOURCE_DRAFT_TTL_MS ||
      typeof value.baseUpdatedAt !== "string" || !Number.isFinite(Date.parse(value.baseUpdatedAt)) ||
      !record(value.details) || !record(value.version)) return null;
    const details = value.details;
    const version = value.version;
    if (!bounded(details.title, 120) || !bounded(details.shortDescription, 250) ||
      !bounded(details.description, 10_000) || !bounded(details.tagsText, 4096) ||
      !bounded(version.version, 64) || !bounded(version.mtaVersionTarget, 64) ||
      !bounded(version.releaseNotes, 5000)) return null;
    // Only recover text, even when an older/tampered payload includes other data.
    return {
      schemaVersion: 1, actorId: scope.actorId, productId: scope.productId,
      savedAt: value.savedAt, baseUpdatedAt: value.baseUpdatedAt,
      details: { title: details.title, shortDescription: details.shortDescription,
        description: details.description, tagsText: details.tagsText },
      version: { version: version.version, mtaVersionTarget: version.mtaVersionTarget,
        releaseNotes: version.releaseNotes },
    };
  } catch { return null; }
}

export function sameAuthorDetails(a: AuthorDetailsDraft, b: AuthorDetailsDraft) {
  return a.title === b.title && a.shortDescription === b.shortDescription &&
    a.description === b.description && a.tagsText === b.tagsText;
}
export function hasAuthorVersionDraft(value: AuthorVersionDraft) {
  return Object.values(value).some((text) => text.length > 0);
}
