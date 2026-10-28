export type NotificationReadTarget = { scope: "all" } | { scope: "single"; id: string };

// An empty request body means "all" for existing clients. Malformed JSON,
// null, arrays and unexpected keys must never silently become a bulk action.
export function parseNotificationReadTarget(raw: string): NotificationReadTarget | null {
  if (raw.length === 0) return { scope: "all" };
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
  if (keys.length === 0) return { scope: "all" };
  if (keys.length !== 1 || keys[0] !== "id") return null;
  if (typeof record.id !== "string") return null;

  const id = record.id.trim();
  return id.length > 0 && id.length <= 128 ? { scope: "single", id } : null;
}
