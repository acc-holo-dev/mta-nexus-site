import { Button } from "@nexus/ui";
import Link from "next/link";
import { collectionReleasesCopy } from "../lib/collection-releases-i18n";
import { collectionRequirementsCopy } from "../lib/collection-requirements-i18n";
import { libraryCollectionComparisonCopy } from "../lib/library-collection-comparison-i18n";
import { libraryCollectionInventoryCopy } from "../lib/library-collection-inventory-i18n";
import { collectionInventoryHref } from "../lib/library-collection-inventory-query";
import { libraryCollectionManifestsCopy } from "../lib/library-collection-manifests-i18n";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionsQuery,
} from "../lib/library-collections-query";
import { librarySelectionBatchesCopy } from "../lib/library-selection-batches-i18n";
import { resourceReleaseWatchesCopy } from "../lib/resource-release-watches-i18n";
import { libraryCollectionsService as service } from "../lib/services/library-collections-service";
import { LibraryCollectionBatchForm } from "./library-collection-batch";
import { LibraryCollectionCommandForm } from "./library-collection-command";
import {
  LibraryCollectionsPagination,
  type LibraryCollectionsActor,
  type LibraryCollectionsQuery,
  libraryCollectionsLinkClass,
  libraryCollectionsSearchFieldClass,
} from "./library-collections-screen-shared";
import { ResourceDownloadButton } from "./resource-download-button";

export async function LibraryCollectionsDetailView({
  locale,
  actor,
  id,
  adding,
  queryValues,
}: {
  locale: "ru" | "en";
  actor: LibraryCollectionsActor;
  id: string;
  adding: boolean;
  queryValues: LibraryCollectionsQuery;
}) {
  const c = libraryCollectionsCopy(locale);
  const query = collectionsQuery(collectionPageParams(queryValues), "detail");
  const result = await service.detail(actor, id, query, adding);
  const collection = result.collection;
  const snapshot = {
    id: collection.id,
    name: collection.name,
    status: collection.status,
    revision: collection.revision,
  };
  const href = (page: number) =>
    collectionHref(id, adding ? "add" : "", {
      page: String(page),
      ...(result.q ? { q: result.q } : {}),
    });
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link
        href={adding ? collectionHref(id) : collectionHref()}
        className={libraryCollectionsLinkClass}
      >
        {adding ? c.back : c.title}
      </Link>
      <h1 className="break-words font-display text-primary">
        {collection.name}
        {adding ? ` · ${c.candidates}` : ""}
      </h1>
      <p className="text-sm">
        {c[collection.status]} · {c.revision} {collection.revision}
      </p>
      <p role="note" className="text-sm text-secondary">
        {c.subtitle}
      </p>
      {collection.status === "archived" && (
        <p role="note" className="rounded border border-base p-4">
          {c.archivedNote}
        </p>
      )}
      {!adding && (
        <>
          <p role="note" className="text-sm text-muted">
            {c.watchesIndependentNote}
          </p>
          <Link
            href={`/workspace/library/collections/${encodeURIComponent(id)}/watches`}
            className={libraryCollectionsLinkClass}
          >
            {resourceReleaseWatchesCopy(locale).collectionTitle}
          </Link>
          <Link href={collectionHref(id, "releases")} className={libraryCollectionsLinkClass}>
            {collectionReleasesCopy(locale).title}
          </Link>
        </>
      )}
      {!adding && (
        <Link href={`${collectionHref(id)}/versions`} className={libraryCollectionsLinkClass}>
          {librarySelectionBatchesCopy(locale).title}
        </Link>
      )}
      {!adding && (
        <Link href={`${collectionHref(id)}/requirements`} className={libraryCollectionsLinkClass}>
          {collectionRequirementsCopy(locale).title}
        </Link>
      )}
      {!adding && (
        <section className="nexus-panel grid gap-5 p-5 sm:grid-cols-2">
          {collection.status === "active" ? (
            <>
              <LibraryCollectionCommandForm
                key={`rename:${collection.revision}`}
                locale={locale}
                collection={snapshot}
                action="rename"
              />
              <LibraryCollectionCommandForm
                key={`archive:${collection.revision}`}
                locale={locale}
                collection={snapshot}
                action="archive"
              />
            </>
          ) : (
            <LibraryCollectionCommandForm
              key={`restore:${collection.revision}`}
              locale={locale}
              collection={snapshot}
              action="restore"
            />
          )}
        </section>
      )}
      <nav className="flex flex-wrap gap-4 text-sm" aria-label={c.title}>
        <a
          href={`/api/library/collections/${encodeURIComponent(id)}/export`}
          className={libraryCollectionsLinkClass}
        >
          {libraryCollectionManifestsCopy(locale).export}
        </a>
        <Link href={collectionHref(id, "reconcile")} className={libraryCollectionsLinkClass}>
          {libraryCollectionManifestsCopy(locale).reconcileTitle}
        </Link>
        <Link href={collectionHref(id, "import")} className={libraryCollectionsLinkClass}>
          {libraryCollectionManifestsCopy(locale).title}
        </Link>
        <Link href={collectionInventoryHref(id)} className={libraryCollectionsLinkClass}>
          {libraryCollectionInventoryCopy(locale).inventory}
        </Link>
        <Link href={collectionHref(id, "compare")} className={libraryCollectionsLinkClass}>
          {libraryCollectionComparisonCopy(locale).title}
        </Link>
        {!adding && collection.status === "active" && (
          <Link href={collectionHref(id, "add")} className={libraryCollectionsLinkClass}>
            {c.candidates}
          </Link>
        )}
        <Link href={collectionHref(id, "copy")} className={libraryCollectionsLinkClass}>
          {c.duplicate}
        </Link>
        {collection.status === "active" && (
          <Link href={collectionHref(id, "move-items")} className={libraryCollectionsLinkClass}>
            {c["move-items"]}
          </Link>
        )}
        <Link href={collectionHref(id, "copy-items")} className={libraryCollectionsLinkClass}>
          {c["copy-items"]}
        </Link>
        <Link href={collectionHref(id, "history")} className={libraryCollectionsLinkClass}>
          {c.history}
        </Link>
      </nav>
      <form
        method="get"
        action={collectionHref(id, adding ? "add" : "")}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="space-y-1">
          <span className="block text-sm">{c.search}</span>
          <input
            name="q"
            defaultValue={result.q}
            maxLength={80}
            className={libraryCollectionsSearchFieldClass}
          />
        </label>
        <Button type="submit" variant="outline">
          {c.apply}
        </Button>
        {result.q && (
          <Link
            href={collectionHref(id, adding ? "add" : "")}
            className={`text-sm ${libraryCollectionsLinkClass}`}
          >
            {c.clear}
          </Link>
        )}
      </form>
      <p className="text-sm">
        {c.items}: {result.total} · {c.ready}: {result.ready}
      </p>
      {!result.items.length && (
        <div className="space-y-3 text-sm text-muted" role="status" aria-live="polite">
          <p>{result.q ? c.emptyFilteredItems : c.emptyItems}</p>
          {result.q && (
            <Link
              href={collectionHref(id, adding ? "add" : "")}
              className={`inline-flex min-h-11 items-center ${libraryCollectionsLinkClass}`}
            >
              {c.clear}
            </Link>
          )}
        </div>
      )}
      {collection.status === "active" && result.items.length > 0 && (
        <LibraryCollectionBatchForm
          key={`batch:${collection.revision}:${adding}:${result.page}:${result.q}`}
          locale={locale}
          collection={snapshot}
          action={adding ? "add-many" : "remove-many"}
          items={result.items.filter((item) => !adding || !item.inCollection)}
        />
      )}
      <ol className="grid gap-4 md:grid-cols-2">
        {result.items.map((item) => (
          <li key={item.productId} className="nexus-panel space-y-3 p-5">
            <h2 className="break-words font-semibold">{item.title ?? c.unavailable}</h2>
            {item.downloadable && item.version ? (
              <ResourceDownloadButton
                productId={item.productId}
                version={item.version}
                buildId={item.buildId ?? undefined}
              />
            ) : (
              <p className="text-sm text-muted">{c.unavailableNote}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              <Link
                href={`/workspace/library/${encodeURIComponent(item.productId)}/collections`}
                className={libraryCollectionsLinkClass}
              >
                {c.toCollection}
              </Link>
              {item.slug && (
                <Link
                  href={`/market/${encodeURIComponent(item.slug)}`}
                  className={libraryCollectionsLinkClass}
                >
                  {c.open}
                </Link>
              )}
              {item.hasAccess && (
                <Link
                  href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                  className={libraryCollectionsLinkClass}
                >
                  {c.versions}
                </Link>
              )}
            </div>
            {collection.status === "active" &&
              (adding && item.inCollection ? (
                <p role="status" className="text-sm text-muted">
                  {c.inCollection}
                </p>
              ) : (
                <LibraryCollectionCommandForm
                  key={`${collection.revision}:${item.productId}`}
                  locale={locale}
                  collection={snapshot}
                  productId={item.productId}
                  action={adding ? "add" : "remove"}
                />
              ))}
          </li>
        ))}
      </ol>
      <LibraryCollectionsPagination bounds={result} locale={locale} href={href} />
      <a
        href={`/api/library/collections/${encodeURIComponent(id)}${adding ? "/candidates" : ""}?${new URLSearchParams({ page: String(result.page), ...(result.q ? { q: result.q } : {}) })}`}
        className={`text-sm ${libraryCollectionsLinkClass}`}
      >
        {c.json}
      </a>
    </div>
  );
}
