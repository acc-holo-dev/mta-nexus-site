import { confirmedCommentId } from "./content-comment-confirmation";

export type ContentCommentFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function submitContentCommentRequest(
  input: {
    slug: string;
    text: string;
    fallbackError: string;
  },
  fetchImpl: ContentCommentFetch = fetch,
): Promise<string> {
  const normalized = input.text.trim();
  if (normalized.length < 2 || normalized.length > 5000) {
    throw new RangeError("Comment text must contain 2..5000 characters");
  }

  const response = await fetchImpl(
    `/api/content/${encodeURIComponent(input.slug)}/comments`,
    {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: normalized }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const payload = await response.json().catch(() => null);
  const id = confirmedCommentId(response.status, payload);
  if (!id) {
    const message =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as Record<string, unknown>).error === "string"
        ? (payload as Record<string, string>).error
        : input.fallbackError;
    throw new Error(message);
  }
  return id;
}
