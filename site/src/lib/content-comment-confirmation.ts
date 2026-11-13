export function confirmedCommentId(status: number, payload: unknown): string | null {
  if (
    !Number.isSafeInteger(status) ||
    status < 200 ||
    status >= 300 ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return null;
  }

  const comment = (payload as Record<string, unknown>).comment;
  if (!comment || typeof comment !== "object" || Array.isArray(comment)) {
    return null;
  }

  const id = (comment as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}
