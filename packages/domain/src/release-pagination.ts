/** Safe fixed-size pagination shared by DB and server-rendered release pages. */
export const RELEASE_HISTORY_PAGE_SIZE = 12;

export function releaseHistoryPageBounds(total: number, requested = 1) {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError("Invalid published release total");
  }
  const totalPages = Math.max(1, Math.ceil(total / RELEASE_HISTORY_PAGE_SIZE));
  const page = Number.isSafeInteger(requested) && requested >= 1
    ? Math.min(requested, totalPages)
    : 1;
  return {
    page,
    total,
    totalPages,
    pageSize: RELEASE_HISTORY_PAGE_SIZE,
    offset: (page - 1) * RELEASE_HISTORY_PAGE_SIZE,
  };
}
