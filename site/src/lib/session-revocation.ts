export type SessionRevocation =
  | { scope: "others"; expectedActorId: string }
  | { scope: "single"; sessionId: string; expectedActorId: string };

// A session ID and an "all other" command must never share a request.
// Reject extra keys so a client typo cannot widen the revocation scope.
export function parseSessionRevocation(value: unknown): SessionRevocation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (
    keys.length !== 2 ||
    !Object.hasOwn(body, "expectedActorId") ||
    typeof body.expectedActorId !== "string"
  )
    return null;
  const expectedActorId = body.expectedActorId;
  if (
    !expectedActorId ||
    expectedActorId.length > 128 ||
    expectedActorId.trim() !== expectedActorId
  )
    return null;

  if (Object.hasOwn(body, "allOther") && body.allOther === true) {
    return { scope: "others", expectedActorId };
  }
  if (!Object.hasOwn(body, "sessionId") || typeof body.sessionId !== "string") return null;
  const sessionId = body.sessionId.trim();
  return sessionId.length > 0 && sessionId.length <= 128
    ? { scope: "single", sessionId, expectedActorId }
    : null;
}
