export type NotificationReadTarget =
  | { scope: "all"; expectedActorId: string }
  | { scope: "single"; id: string; expectedActorId: string };

// The actor is a precondition, never a selector: stale clients fail closed.
export function parseNotificationReadTarget(raw: string): NotificationReadTarget | null {
  if (raw.length > 1024) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  const expectedActorId = record.expectedActorId;
  if (
    typeof expectedActorId !== "string" ||
    !expectedActorId ||
    expectedActorId.length > 128 ||
    expectedActorId.trim() !== expectedActorId
  )
    return null;
  if (keys.length === 1 && keys[0] === "expectedActorId") return { scope: "all", expectedActorId };
  if (keys.length !== 2 || !keys.includes("id") || !keys.includes("expectedActorId")) return null;
  if (typeof record.id !== "string") return null;

  const id = record.id.trim();
  return id.length > 0 && id.length <= 128 ? { scope: "single", id, expectedActorId } : null;
}
