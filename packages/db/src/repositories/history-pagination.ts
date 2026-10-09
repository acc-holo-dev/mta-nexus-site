/**
 * Shared bounded pagination for legacy, read-only financial history.
 * Never accept a client-supplied page size or an unbounded history query.
 */
export const HISTORY_PAGE_SIZE = 20;

export function historyPageBounds(total: number, requestedPage = 1) {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError("Invalid history total");
  }
  const pageSize = HISTORY_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  return {
    page,
    pageSize,
    total,
    totalPages,
    offset: (page - 1) * pageSize,
  };
}
