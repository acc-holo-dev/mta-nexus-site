import type { Locale } from "./i18n";
import { discussionError } from "./content-discussion-copy";
import { confirmedCommentId } from "./content-comment-confirmation";

export type ContentCommentFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

/** Client intent key for one publish attempt; reuse after lost responses. */
export function createCommentIntentKey(): string {
  return crypto.randomUUID();
}

export function parseCommentIntentKey(value: string | null | undefined): string | null {
  return typeof value === "string" && uuidV4.test(value) ? value : null;
}

export async function submitContentCommentRequest(
  input: {
    slug: string;
    text: string;
    fallbackError: string;
    intentKey: string;
    parentId?: string;
    contentId?: string;
    locale?: Locale;
  },
  fetchImpl: ContentCommentFetch = fetch,
): Promise<string> {
  const normalized = input.text.trim();
  if (normalized.length < 2 || normalized.length > 5000) {
    throw new RangeError("Comment text must contain 2..5000 characters");
  }
  const intentKey = parseCommentIntentKey(input.intentKey);
  if (!intentKey) {
    throw new RangeError("Comment intent key must be a UUIDv4 Idempotency-Key");
  }

  const response = await fetchImpl(`/api/content/${encodeURIComponent(input.slug)}/comments`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": intentKey,
    },
    body: JSON.stringify({
      text: normalized,
      ...(input.parentId ? { parentId: input.parentId } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new Error(input.fallbackError);
  });
  const payload = await response.json().catch(() => null);
  const id = confirmedCommentId(response.status, payload);
  const confirmed =
    !input.contentId ||
    (payload?.comment?.contentId === input.contentId &&
      payload?.comment?.text === normalized &&
      (payload?.comment?.parentId ?? undefined) === input.parentId);
  if (!id || !confirmed) {
    const message =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as Record<string, unknown>).error === "string"
        ? (payload as Record<string, string>).error
        : input.fallbackError;
    throw new Error(
      input.locale ? discussionError(input.locale, payload?.code ?? "UNCONFIRMED") : message,
    );
  }
  return id;
}
