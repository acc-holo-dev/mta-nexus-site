export type ConfirmedWalletHoldRelease = {
  accountId: string;
  organizationId: string | null;
  releasedCount: number;
};

export function confirmedWalletHoldRelease(body: unknown): ConfirmedWalletHoldRelease | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.accountId !== "string" || !record.accountId) return null;
  const organizationId =
    record.organizationId === null
      ? null
      : typeof record.organizationId === "string"
        ? record.organizationId
        : undefined;
  if (organizationId === undefined) return null;
  if (!Array.isArray(record.released)) return null;
  return {
    accountId: record.accountId,
    organizationId,
    releasedCount: record.released.length,
  };
}
