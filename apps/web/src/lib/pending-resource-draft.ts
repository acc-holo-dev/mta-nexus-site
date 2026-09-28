export interface PendingResourceDraft {
  id: string;
  slug: string;
  mtaVersionTarget: string;
}

export const PENDING_RESOURCE_DRAFT_KEY = "nexus:pending-resource-draft:v1";

export function parsePendingResourceDraft(
  value: string | null,
): PendingResourceDraft | null {
  if (!value || value.length > 512) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;

    const draft = parsed as Record<string, unknown>;
    if (
      typeof draft.id !== "string" ||
      draft.id.length < 3 ||
      draft.id.length > 128 ||
      typeof draft.slug !== "string" ||
      !/^[a-z0-9-]{3,120}$/u.test(draft.slug) ||
      typeof draft.mtaVersionTarget !== "string" ||
      draft.mtaVersionTarget.length > 64
    ) {
      return null;
    }

    return {
      id: draft.id,
      slug: draft.slug,
      mtaVersionTarget: draft.mtaVersionTarget,
    };
  } catch {
    return null;
  }
}
