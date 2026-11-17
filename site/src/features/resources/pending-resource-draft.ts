export interface PendingResourceDraft {
  id: string;
  slug: string;
  mtaVersionTarget: string;
}

// Legacy records have no reliable author identity and must never be restored.
export const PENDING_RESOURCE_DRAFT_KEY = "nexus:pending-resource-draft:v1";
export const PENDING_RESOURCE_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
export function pendingResourceDraftKey(actorId: string) {
  return `nexus:pending-resource-draft:v2:${encodeURIComponent(actorId)}`;
}
export function createPendingResourceDraft(
  draft: PendingResourceDraft,
  actorId: string,
  now = Date.now(),
) {
  return {
    schemaVersion: 2,
    actorId,
    savedAt: now,
    id: draft.id,
    slug: draft.slug,
    mtaVersionTarget: draft.mtaVersionTarget,
  };
}
export function parsePendingResourceDraft(
  value: string | null,
  actorId: string,
  now = Date.now(),
): PendingResourceDraft | null {
  if (!value || value.length > 1024) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const draft = parsed as Record<string, unknown>;
    if (
      draft.schemaVersion !== 2 ||
      draft.actorId !== actorId ||
      typeof draft.savedAt !== "number" ||
      !Number.isFinite(draft.savedAt) ||
      draft.savedAt > now ||
      now - draft.savedAt >= PENDING_RESOURCE_DRAFT_TTL_MS ||
      typeof draft.id !== "string" ||
      draft.id.trim().length < 3 ||
      draft.id.length > 128 ||
      typeof draft.slug !== "string" ||
      !/^[a-z0-9-]{3,120}$/u.test(draft.slug) ||
      typeof draft.mtaVersionTarget !== "string" ||
      draft.mtaVersionTarget.length > 64 ||
      (draft.mtaVersionTarget !== "" && !/^1\.[0-9]+(\.[0-9]+)?$/u.test(draft.mtaVersionTarget))
    )
      return null;
    return { id: draft.id, slug: draft.slug, mtaVersionTarget: draft.mtaVersionTarget };
  } catch {
    return null;
  }
}
