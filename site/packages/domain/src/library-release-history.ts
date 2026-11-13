export const LIBRARY_RELEASE_HISTORY_DAYS = [7, 30, 90, 365] as const;
export type LibraryReleaseHistoryDays = (typeof LIBRARY_RELEASE_HISTORY_DAYS)[number];
export type LibraryReleaseHistoryQuery = {
  page: number;
  days: LibraryReleaseHistoryDays;
  productId?: string;
};
export function recordedLibraryRelease(value: unknown) {
  const unknown = { selection: null, source: "unknown" as const };
  if (!value || typeof value !== "object" || Array.isArray(value)) return unknown;
  const r = value as Record<string, unknown>;
  if (
    !Number.isInteger(r.revision) ||
    Number(r.revision) < 1 ||
    Number(r.revision) > 2_147_483_647 ||
    (r.mode !== "latest" && r.mode !== "fixed") ||
    (r.mode === "latest"
      ? r.buildId !== null
      : typeof r.buildId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(r.buildId))
  )
    return unknown;
  const source =
    r.batchReceiptId == null
      ? ("individual" as const)
      : typeof r.batchReceiptId === "string" &&
          /^lsbr_[A-Za-z0-9_-]{1,150}$/u.test(r.batchReceiptId)
        ? ("batch" as const)
        : ("unknown" as const);
  return {
    selection: {
      mode: r.mode as "latest" | "fixed",
      buildId: r.buildId as string | null,
      revision: Number(r.revision),
    },
    source,
  };
}
