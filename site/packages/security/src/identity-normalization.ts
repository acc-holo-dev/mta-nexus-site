export function normalizeEmailForAbuse(value: string): string {
  if (typeof value !== "string") throw new Error("Invalid email abuse identity");
  const normalized = value.trim().normalize("NFC").toLowerCase();
  if (!normalized || normalized.length > 320 || normalized.includes("\0")) {
    throw new Error("Invalid email abuse identity");
  }
  return normalized;
}
