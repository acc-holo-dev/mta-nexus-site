export type ConfirmedWalletAdminBatch = {
  count: number;
  actorId: string;
};

/** Narrow admin batch responses that return `{ count, actorId, … }`. */
export function confirmedWalletAdminBatch(
  body: unknown,
  expectedActorId: string,
): ConfirmedWalletAdminBatch | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.actorId !== "string" || record.actorId !== expectedActorId) return null;
  if (typeof record.count !== "number" || !Number.isInteger(record.count) || record.count < 0) {
    return null;
  }
  return { count: record.count, actorId: record.actorId };
}
