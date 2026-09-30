import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";

export function ProfileResourcePagination({
  basePath,
  page,
  totalPages,
  locale,
  section = "resources",
  otherPage = 1,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  locale: Locale;
  section?: "resources" | "servers";
  otherPage?: number;
}) {
  if (totalPages <= 1) return null;
  const dictionary = getDictionary(locale);
  const copy = dictionary.market;
  const href = (target: number) => {
    const query = new URLSearchParams();
    if (section === "resources") {
      query.set("page", String(target));
      if (otherPage > 1) query.set("serverPage", String(otherPage));
    } else {
      if (otherPage > 1) query.set("page", String(otherPage));
      query.set("serverPage", String(target));
    }
    return `${basePath}?${query}#${section}`;
  };
  return (
    <nav
      aria-label={
        section === "resources" ? copy.paginationLabel : dictionary.profiles.operatedServers
      }
      className="flex items-center justify-between gap-3"
    >
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
