export type SessionRevocation =
  | { scope: "others" }
  | { scope: "single"; sessionId: string };

// A session ID and an "all other" command must never share a request.
// Reject extra keys so a client typo cannot widen the revocation scope.
export function parseSessionRevocation(value: unknown): SessionRevocation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length !== 1) return null;

  if (keys[0] === "allOther" && body.allOther === true) {
    return { scope: "others" };
  }
  if (keys[0] !== "sessionId" || typeof body.sessionId !== "string") return null;
  const sessionId = body.sessionId.trim();
  return sessionId.length > 0 && sessionId.length <= 128
    ? { scope: "single", sessionId }
    : null;
}
