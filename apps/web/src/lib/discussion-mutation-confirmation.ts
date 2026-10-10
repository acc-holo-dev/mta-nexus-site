export function confirmsDiscussionMutation(
  value: unknown,
  contentId: string,
  commentId: string,
  text?: string,
): value is {
  contentId: string;
  commentId: string;
  text?: string;
  revision?: string;
  removed?: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  if (result.contentId !== contentId || result.commentId !== commentId) return false;
  return text === undefined
    ? result.removed === true
    : result.text === text &&
        typeof result.revision === "string" &&
        /^[a-f0-9]{64}$/u.test(result.revision);
}
