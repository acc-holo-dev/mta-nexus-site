import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";

export function ProfileResourcePagination({
  basePath,
  page,
  totalPages,
  locale,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  locale: Locale;
}) {
  if (totalPages <= 1) return null;
  const copy = getDictionary(locale).market;
  const href = (target: number) => `${basePath}?page=${target}#resources`;
  return (
    <nav aria-label={copy.paginationLabel} className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="text-sm text-accent underline">
          {copy.previousPage}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-secondary">
        {copy.pageLabel} {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className="text-sm text-accent underline">
          {copy.nextPage}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
