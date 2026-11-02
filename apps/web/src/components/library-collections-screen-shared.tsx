import type { User } from "@nexus/domain";
import Link from "next/link";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../lib/library-collections-query";

/** Authenticated session user passed from `authService.getSession`. */
export type LibraryCollectionsActor = User;

export type LibraryCollectionsQuery = Record<string, string | string[] | undefined>;
export type LibraryCollectionsBounds = { page: number; totalPages: number; total: number };
export type LibraryCollectionsView =
  | "list"
  | "detail"
  | "add"
  | "history"
  | "copy"
  | "copy-items"
  | "move-items";

export const libraryCollectionsLinkClass =
  "text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const libraryCollectionsFieldClass =
  "rounded border border-base bg-inset px-3 py-2 transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";

export const libraryCollectionsSearchFieldClass =
  "rounded border border-base bg-surface p-2 transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";

export function guestCollectionsReturnPath(
  view: LibraryCollectionsView,
  queryValues: LibraryCollectionsQuery,
  collectionId?: string,
): string {
  const params = collectionPageParams(queryValues);
  const query = Object.fromEntries(params.entries());
  const sectionByView: Partial<Record<LibraryCollectionsView, string>> = {
    history: "history",
    add: "add",
    copy: "copy",
    "copy-items": "copy-items",
    "move-items": "move-items",
  };
  return collectionHref(collectionId, sectionByView[view] ?? "", query);
}

export function LibraryCollectionsPagination({
  bounds,
  locale,
  href,
}: {
  bounds: LibraryCollectionsBounds;
  locale: "ru" | "en";
  href: (page: number) => string;
}) {
  const c = libraryCollectionsCopy(locale);
  return (
    <nav aria-label={c.page} className="flex flex-wrap gap-4 text-sm">
      {bounds.page > 1 && (
        <Link href={href(bounds.page - 1)} className={libraryCollectionsLinkClass}>
          {c.previous}
        </Link>
      )}
      <span>
        {c.page} {bounds.page} {c.of} {bounds.totalPages}
      </span>
      {bounds.page < bounds.totalPages && (
        <Link href={href(bounds.page + 1)} className={libraryCollectionsLinkClass}>
          {c.next}
        </Link>
      )}
    </nav>
  );
}
