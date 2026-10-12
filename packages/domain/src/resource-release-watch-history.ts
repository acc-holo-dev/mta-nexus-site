import type { LibraryReleaseHistoryQuery } from "./library-release-history";
export const RESOURCE_RELEASE_WATCH_HISTORY_SOURCES = [
  "all",
  "individual",
  "batch",
  "collection",
] as const;
export type ResourceReleaseWatchHistoryQuery = LibraryReleaseHistoryQuery & {
  source: (typeof RESOURCE_RELEASE_WATCH_HISTORY_SOURCES)[number];
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,160}$/u.test(value);
const revision = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 2_147_483_647;
export type RecordedResourceReleaseWatchOperation = {
  source: "individual" | "batch" | "collection" | "unknown";
  changes: { productId: string; enabled: boolean; revision: number }[] | null;
  collection: { id: string; revision: number } | null;
};
export function recordedResourceReleaseWatchOperation(
  action: string,
  targetId: string,
  payload: unknown,
): RecordedResourceReleaseWatchOperation {
  const unknown = { source: "unknown" as const, changes: null, collection: null };
  if (!record(payload)) return unknown;
  if (action === "library.release_watch_changed") {
    if (!id(targetId) || typeof payload.enabled !== "boolean" || !revision(payload.revision))
      return unknown;
    return {
      source: "individual" as const,
      changes: [{ productId: targetId, enabled: payload.enabled, revision: payload.revision }],
      collection: null,
    };
  }
  const source =
    action === "library.release_watches_disabled" || action === "library.release_watches_resumed"
      ? "batch"
      : action === "library.collection_release_watches_enabled"
        ? "collection"
        : null;
  if (
    !source ||
    !Array.isArray(payload.items) ||
    payload.items.length < 1 ||
    payload.items.length > 20 ||
    payload.changedCount !== payload.items.length
  )
    return unknown;
  const items = payload.items;
  if (
    items.some((item) => !record(item) || !id(item.productId) || !revision(item.revision)) ||
    new Set(items.map((item) => item.productId)).size !== items.length
  )
    return unknown;
  if (source === "collection" && (!id(targetId) || !revision(payload.collectionRevision)))
    return unknown;
  return {
    source,
    changes: items
      .map((item) => ({
        productId: item.productId as string,
        enabled: source === "collection" || action === "library.release_watches_resumed",
        revision: item.revision as number,
      }))
      .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
    collection:
      source === "collection"
        ? { id: targetId, revision: payload.collectionRevision as number }
        : null,
  };
}
