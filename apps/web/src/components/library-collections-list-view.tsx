import { EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { getDictionary } from "../lib/i18n";
import { libraryCollectionHistoryCopy } from "../lib/library-collection-history-i18n";
import { libraryCollectionInventoryCopy } from "../lib/library-collection-inventory-i18n";
import { collectionInventoryHref } from "../lib/library-collection-inventory-query";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionsQuery,
} from "../lib/library-collections-query";
import { libraryMembershipHistoryCopy } from "../lib/library-membership-history-i18n";
import { membershipHistoryHref } from "../lib/library-membership-history-query";
import { libraryCollectionsService as service } from "../lib/services/library-collections-service";
import { LibraryCollectionCommandForm } from "./library-collection-command";
import {
  type LibraryCollectionsActor,
  LibraryCollectionsPagination,
  type LibraryCollectionsQuery,
  libraryCollectionsLinkClass,
} from "./library-collections-screen-shared";

export async function LibraryCollectionsListView({
  locale,
  actor,
  queryValues,
}: {
  locale: "ru" | "en";
  actor: LibraryCollectionsActor;
  queryValues: LibraryCollectionsQuery;
}) {
  const c = libraryCollectionsCopy(locale);
  const dictionary = getDictionary(locale);
  const query = collectionsQuery(collectionPageParams(queryValues), "list");
  const retryHref = collectionHref(undefined, "", {
    status: query.status,
    page: String(query.page),
  });
  const result = await service.page(actor, query).catch(() => null);
  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
        <Link href="/workspace/library" className={libraryCollectionsLinkClass}>
          {c.library}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          action={
            <Link
              href={retryHref}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8">
      <Link href="/workspace/library" className={libraryCollectionsLinkClass}>
        {c.library}
      </Link>
      <h1 className="font-display text-primary">{c.title}</h1>
      <Link href={membershipHistoryHref()} className={libraryCollectionsLinkClass}>
        {libraryMembershipHistoryCopy(locale).history}
      </Link>
      <Link href={collectionInventoryHref()} className={libraryCollectionsLinkClass}>
        {libraryCollectionInventoryCopy(locale).inventory}
      </Link>
      <Link href="/workspace/library/collections/history" className={libraryCollectionsLinkClass}>
        {libraryCollectionHistoryCopy(locale).title}
      </Link>
      <p className="text-sm text-secondary">{c.subtitle}</p>
      <p role="note" className="text-sm text-muted">
        {c.limit}
      </p>
      <section className="nexus-panel space-y-3 p-5">
        <h2 className="font-semibold">{c.create}</h2>
        <LibraryCollectionCommandForm locale={locale} />
      </section>
      <nav aria-label={c.title} className="flex gap-4">
        {(["active", "archived", "all"] as const).map((status) => (
          <Link
            key={status}
            href={collectionHref(undefined, "", { status })}
            aria-current={result.status === status ? "page" : undefined}
            className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:font-bold"
          >
            {c[status]}
          </Link>
        ))}
      </nav>
      {!result.items.length && (
        <EmptyState
          title={result.status === "active" ? c.empty : c.emptyFiltered}
          description={c.subtitle}
          action={
            result.status !== "active" ? (
              <Link
                href={collectionHref()}
                className={`inline-flex min-h-11 items-center ${libraryCollectionsLinkClass}`}
              >
                {c.clear}
              </Link>
            ) : (
              <Link
                href="/market?maxPrice=0"
                className={`inline-flex min-h-11 items-center ${libraryCollectionsLinkClass}`}
              >
                {c.browseLibrary}
              </Link>
            )
          }
        />
      )}
      <ol className="grid gap-4 sm:grid-cols-2">
        {result.items.map((item) => (
          <li key={item.id} className="nexus-panel space-y-2 p-5">
            <h2 className="break-words font-semibold">
              <Link href={collectionHref(item.id)} className={libraryCollectionsLinkClass}>
                {item.name}
              </Link>
            </h2>
            <p className="text-sm">
              {c[item.status]} · {c.items}: {item.itemCount} · {c.revision}: {item.revision}
            </p>
          </li>
        ))}
      </ol>
      <LibraryCollectionsPagination
        bounds={result}
        locale={locale}
        href={(page) =>
          collectionHref(undefined, "", { status: result.status, page: String(page) })
        }
      />
      <a
        href={`/api/library/collections?${new URLSearchParams({ status: result.status, page: String(result.page) })}`}
        className={`text-sm ${libraryCollectionsLinkClass}`}
      >
        {c.json}
      </a>
    </div>
  );
}
