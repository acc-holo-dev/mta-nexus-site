import { Button, EmptyState } from "@nexus/ui";
import Link from "next/link";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionsQuery,
} from "../lib/library-collections-query";
import { libraryCollectionsService as service } from "../lib/services/library-collections-service";
import { LibraryCollectionItemCopyForm } from "./library-collection-item-copy";
import {
  type LibraryCollectionsActor,
  LibraryCollectionsPagination,
  type LibraryCollectionsQuery,
  type LibraryCollectionsView,
  libraryCollectionsFieldClass,
  libraryCollectionsLinkClass,
} from "./library-collections-screen-shared";

export async function LibraryCollectionsItemTransferView({
  locale,
  actor,
  id,
  view,
  queryValues,
}: {
  locale: "ru" | "en";
  actor: LibraryCollectionsActor;
  id: string;
  view: Extract<LibraryCollectionsView, "copy-items" | "move-items">;
  queryValues: LibraryCollectionsQuery;
}) {
  const c = libraryCollectionsCopy(locale);
  const query = collectionsQuery(collectionPageParams(queryValues), "detail");
  const result = await service.copyItemsPage(actor, id, query);
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href={collectionHref(id)} className={libraryCollectionsLinkClass}>
        {c.back}
      </Link>
      <h1 className="font-display">{c[view]}</h1>
      <p className="break-words">
        {c.source}: {result.source.name} · {c[result.source.status]} · {c.revision}{" "}
        {result.source.revision}
      </p>
      <search aria-label={c.search}>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            {c.search}
            <input
              name="q"
              defaultValue={result.q}
              maxLength={80}
              className={`min-h-11 ${libraryCollectionsFieldClass}`}
            />
          </label>
          <Button type="submit" variant="outline">
            {c.apply}
          </Button>
          {result.q && (
            <Link
              href={collectionHref(id, view)}
              className={`text-sm ${libraryCollectionsLinkClass}`}
            >
              {c.clear}
            </Link>
          )}
        </form>
      </search>
      {!result.items.length && (
        <EmptyState
          title={result.q ? c.emptyFilteredItems : c.emptyItems}
          description={c.emptyItemsHint}
          action={
            result.q ? (
              <Link
                href={collectionHref(id, view)}
                className={`inline-flex min-h-11 items-center ${libraryCollectionsLinkClass}`}
              >
                {c.clear}
              </Link>
            ) : undefined
          }
        />
      )}
      <LibraryCollectionItemCopyForm
        key={JSON.stringify([
          view,
          result.source,
          result.items.map((item) => item.productId),
          result.destinations,
        ])}
        move={view === "move-items"}
        locale={locale}
        source={result.source}
        items={result.items}
        destinations={result.destinations}
      />
      <LibraryCollectionsPagination
        bounds={result}
        locale={locale}
        href={(page) =>
          collectionHref(id, view, {
            page: String(page),
            ...(result.q ? { q: result.q } : {}),
          })
        }
      />
      <a
        href={`/api/library/collections/${encodeURIComponent(id)}/${view}?${new URLSearchParams({ page: String(result.page), ...(result.q ? { q: result.q } : {}) })}`}
        className={libraryCollectionsLinkClass}
      >
        {c.json}
      </a>
    </div>
  );
}
