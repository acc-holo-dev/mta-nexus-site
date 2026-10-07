export type VerificationDecisionAction = "approve" | "reject";

export function normalizeVerificationReviewNotes(
  value: string,
): string | null {
  const notes = value.trim();
  return notes.length >= 3 && notes.length <= 2000
    ? notes
    : null;
}

export function buildVerificationDecisionPayload(
  requestId: string,
  action: VerificationDecisionAction,
  rawNotes: string,
) {
  const targetId = requestId.trim();
  const notes = normalizeVerificationReviewNotes(rawNotes);
  if (!targetId || targetId.length > 128 || !notes) return null;

  return Object.freeze({
    targetType: "verification" as const,
    targetId,
    action,
    notes,
  });
}
