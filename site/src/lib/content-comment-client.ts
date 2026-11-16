import { confirmedCommentId } from "./content-comment-confirmation";
import { discussionError } from "./content-discussion-copy";
import type { Locale } from "./i18n";

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

export class ContentCommentSubmitError extends Error {
  readonly code: unknown;

  constructor(message: string, code: unknown) {
    super(message);
    this.name = "ContentCommentSubmitError";
    this.code = code;
  }
}

function readCommentSubmitCode(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "UNCONFIRMED";
  return "code" in payload
    ? ((payload as Record<string, unknown>).code ?? "UNCONFIRMED")
    : "UNCONFIRMED";
}

export async function submitContentCommentRequest(
  input: {
    slug: string;
    text: string;
    fallbackError: string;
    intentKey: string;
    expectedActorId: string;
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
  if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(input.expectedActorId))
    throw new RangeError("Expected actor is required");
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
      "x-nexus-actor-id": input.expectedActorId,
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
    id === `cmt_${intentKey.replaceAll("-", "")}` &&
    payload?.comment?.authorId === input.expectedActorId &&
    (!input.contentId ||
      (payload?.comment?.contentId === input.contentId &&
        payload?.comment?.text === normalized &&
        (payload?.comment?.parentId ?? undefined) === input.parentId));
  if (!id || !confirmed) {
    const code = readCommentSubmitCode(payload);
    const message =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as Record<string, unknown>).error === "string"
        ? (payload as Record<string, string>).error
        : input.fallbackError;
    throw new ContentCommentSubmitError(
      input.locale ? discussionError(input.locale, code) : message,
      code,
    );
  }
  return id;
}
