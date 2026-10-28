/** Bounded SQL pages for effective resource grants; no database imports. */
export const USER_LIBRARY_PAGE_SIZE = 12;
const MAX_LIBRARY_PAGE_SIZE = 24;

export function libraryPageBounds(
  total: number,
  requestedPage = 1,
  requestedPageSize = USER_LIBRARY_PAGE_SIZE,
) {
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new RangeError("Invalid library total");
  }
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.max(1, Math.min(MAX_LIBRARY_PAGE_SIZE, Math.floor(requestedPageSize)))
    : USER_LIBRARY_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  return { page, pageSize, totalPages, offset: (page - 1) * pageSize };
}
