/**
 * Persist a discussion compose draft across sign-in navigation.
 * Never auto-publishes after restore; clears only after a confirmed publish.
 */

export type DiscussionComposeDraft = {
  version: 1;
  contentId: string;
  text: string;
  parentId?: string;
  parentName?: string;
  savedAt: number;
};

export type DiscussionComposeDraftStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "nexus:discussion:compose:v1:";
const TTL_MS = 24 * 60 * 60 * 1000;
const CONTENT_ID = /^[a-zA-Z0-9_-]{1,128}$/u;
const PARENT_ID = /^[a-zA-Z0-9_-]{1,128}$/u;

const memory = new Map<string, string>();
const fallbackStore: DiscussionComposeDraftStore = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

function discussionComposeDraftSlot(contentId: string): string {
  return `${PREFIX}${contentId}`;
}

function resolveStore(store?: DiscussionComposeDraftStore | null): DiscussionComposeDraftStore {
  if (store !== undefined) return store ?? fallbackStore;
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : fallbackStore;
  } catch {
    return fallbackStore;
  }
}

export function parseDiscussionComposeDraft(
  raw: string | null | undefined,
  contentId: string,
  now = Date.now(),
): DiscussionComposeDraft | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 12_000) return null;
  if (!CONTENT_ID.test(contentId)) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const draft = value as Partial<DiscussionComposeDraft>;
    if (
      draft.version !== 1 ||
      draft.contentId !== contentId ||
      typeof draft.text !== "string" ||
      draft.text.length < 1 ||
      draft.text.length > 5000 ||
      typeof draft.savedAt !== "number" ||
      !Number.isSafeInteger(draft.savedAt) ||
      draft.savedAt > now ||
      now - draft.savedAt > TTL_MS
    ) {
      return null;
    }
    if (draft.parentId !== undefined) {
      if (typeof draft.parentId !== "string" || !PARENT_ID.test(draft.parentId)) return null;
    }
    if (draft.parentName !== undefined) {
      if (typeof draft.parentName !== "string" || draft.parentName.length > 120) return null;
    }
    return {
      version: 1,
      contentId,
      text: draft.text,
      ...(draft.parentId ? { parentId: draft.parentId } : {}),
      ...(draft.parentName ? { parentName: draft.parentName } : {}),
      savedAt: draft.savedAt,
    };
  } catch {
    return null;
  }
}

export function readDiscussionComposeDraft(
  contentId: string,
  options?: { store?: DiscussionComposeDraftStore | null; now?: number },
): DiscussionComposeDraft | null {
  if (!CONTENT_ID.test(contentId)) return null;
  const store = resolveStore(options?.store);
  const slot = discussionComposeDraftSlot(contentId);
  try {
    const parsed = parseDiscussionComposeDraft(store.getItem(slot), contentId, options?.now);
    if (!parsed) {
      try {
        store.removeItem(slot);
      } catch {
        // Ignore unavailable storage.
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDiscussionComposeDraft(
  draft: Omit<DiscussionComposeDraft, "version" | "savedAt"> & { savedAt?: number },
  options?: { store?: DiscussionComposeDraftStore | null; now?: number },
): boolean {
  const text = draft.text.trimEnd();
  if (!CONTENT_ID.test(draft.contentId) || text.length < 1 || text.length > 5000) return false;
  const store = resolveStore(options?.store);
  const payload: DiscussionComposeDraft = {
    version: 1,
    contentId: draft.contentId,
    text,
    ...(draft.parentId && PARENT_ID.test(draft.parentId) ? { parentId: draft.parentId } : {}),
    ...(draft.parentName && draft.parentName.length <= 120 ? { parentName: draft.parentName } : {}),
    savedAt: draft.savedAt ?? options?.now ?? Date.now(),
  };
  try {
    store.setItem(discussionComposeDraftSlot(draft.contentId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearDiscussionComposeDraft(
  contentId: string,
  options?: { store?: DiscussionComposeDraftStore | null },
): void {
  if (!CONTENT_ID.test(contentId)) return;
  try {
    resolveStore(options?.store).removeItem(discussionComposeDraftSlot(contentId));
  } catch {
    // Ignore unavailable storage.
  }
}
