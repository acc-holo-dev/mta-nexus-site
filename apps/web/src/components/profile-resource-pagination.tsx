import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";

export function ProfileResourcePagination({
  basePath,
  page,
  totalPages,
  locale,
  section = "resources",
  otherPage = 1,
  otherSection = "servers",
}: {
  basePath: string;
  page: number;
  totalPages: number;
  locale: Locale;
  section?: "resources" | "servers" | "articles";
  otherSection?: "servers" | "articles";
  otherPage?: number;
}) {
  if (totalPages <= 1) return null;
  const dictionary = getDictionary(locale);
  const copy = dictionary.market;
  const labels = {
    resources: copy.paginationLabel,
    articles: dictionary.organizations.articles,
    servers: dictionary.profiles.operatedServers,
  };
  const secondaryParameter =
    (section === "resources" ? otherSection : section) === "articles"
      ? "articlePage"
      : "serverPage";
  const href = (target: number) => {
    const query = new URLSearchParams();
    if (section === "resources") {
      query.set("page", String(target));
      if (otherPage > 1) query.set(secondaryParameter, String(otherPage));
    } else {
      if (otherPage > 1) query.set("page", String(otherPage));
      query.set(secondaryParameter, String(target));
    }
    return `${basePath}?${query}#${section}`;
  };
  return (
    <nav aria-label={labels[section]} className="flex items-center justify-between gap-3">
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
