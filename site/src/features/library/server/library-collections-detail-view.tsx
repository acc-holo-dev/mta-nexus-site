import { Button, EmptyState, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { libraryCollectionsService as service } from "../../../lib/services/library/library-collections-service";
import { ResourceDownloadButton } from "../../resources/download";
import { resourceReleaseWatchesCopy } from "../../resources/resource-release-watches-i18n";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import {
  typeBreakDisplayPrimary,
  typeBreakSemibold,
  typeFlexWrapEndGap3,
  typeFlexWrapGap4Sm,
  typeGridGap4Md2,
  typeSmMuted,
  typeSmSecondary,
} from "../../shell/type-shell";
import { LibraryCollectionBatchForm } from "../collection-batch";
import { LibraryCollectionCommandForm } from "../collection-command";
import { collectionReleasesCopy } from "../collection-releases-i18n";
import { collectionRequirementsCopy } from "../collection-requirements-i18n";
import { libraryCollectionComparisonCopy } from "../library-collection-comparison-i18n";
import { libraryCollectionInventoryCopy } from "../library-collection-inventory-i18n";
import { collectionInventoryHref } from "../library-collection-inventory-query";
import { libraryCollectionManifestsCopy } from "../library-collection-manifests-i18n";
import { libraryCollectionsCopy } from "../library-collections-i18n";
import {
  collectionHref,
  collectionPageParams,
  collectionsQuery,
} from "../library-collections-query";
import { librarySelectionBatchesCopy } from "../library-selection-batches-i18n";
import {
  type LibraryCollectionsActor,
  LibraryCollectionsPagination,
  type LibraryCollectionsQuery,
  libraryCollectionsLinkClass,
  libraryCollectionsSearchFieldClass,
} from "./library-collections-screen-shared";

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
    <div className={pageShellMax5xl}>
      <Link
        href={adding ? collectionHref(id) : collectionHref()}
        className={libraryCollectionsLinkClass}
      >
        {adding ? c.back : c.title}
      </Link>
      <h1 className={typeBreakDisplayPrimary}>
        {collection.name}
        {adding ? ` · ${c.candidates}` : ""}
      </h1>
      <p className="text-sm">
        {c[collection.status]} · {c.revision} {collection.revision}
      </p>
      <p role="note" className={typeSmSecondary}>
        {c.subtitle}
      </p>
      {collection.status === "archived" && (
        <p role="note" className="rounded border border-base p-4">
          {c.archivedNote}
        </p>
      )}
      {!adding && (
        <>
          <p role="note" className={typeSmMuted}>
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
                actorId={actor.id}
                key={`rename:${collection.revision}`}
                locale={locale}
                collection={snapshot}
                action="rename"
              />
              <LibraryCollectionCommandForm
                actorId={actor.id}
                key={`archive:${collection.revision}`}
                locale={locale}
                collection={snapshot}
                action="archive"
              />
            </>
          ) : (
            <LibraryCollectionCommandForm
              actorId={actor.id}
              key={`restore:${collection.revision}`}
              locale={locale}
              collection={snapshot}
              action="restore"
            />
          )}
        </section>
      )}
      <nav className={typeFlexWrapGap4Sm} aria-label={c.title}>
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
      <search aria-label={c.search}>
        <form
          method="get"
          action={collectionHref(id, adding ? "add" : "")}
          className={typeFlexWrapEndGap3}
        >
          <label className="space-y-1">
            <span className="block text-sm">{c.search}</span>
            <input
              name="q"
              defaultValue={result.q}
              maxLength={80}
              className={`min-h-11 ${libraryCollectionsSearchFieldClass}`}
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
      </search>
      <p className="text-sm">
        {c.items}: {result.total} · {c.ready}: {result.ready}
      </p>
      {!result.items.length && (
        <EmptyState
          title={result.q ? c.emptyFilteredItems : c.emptyItems}
          description={c.emptyItemsHint}
          action={
            result.q ? (
              <Link
                href={collectionHref(id, adding ? "add" : "")}
                className={`inline-flex min-h-11 items-center ${libraryCollectionsLinkClass}`}
              >
                {c.clear}
              </Link>
            ) : undefined
          }
        />
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
      <ol className={typeGridGap4Md2}>
        {result.items.map((item) => (
          <li key={item.productId} className={panelSpace3P5}>
            <h2 className={typeBreakSemibold}>{item.title ?? c.unavailable}</h2>
            {item.downloadable && item.version ? (
              <ResourceDownloadButton
                productId={item.productId}
                version={item.version}
                buildId={item.buildId ?? undefined}
              />
            ) : (
              <ErrorState
                id="library-collection-item-unavailable"
                title={c.unavailableNote}
                description={c.itemUnavailableHint}
              />
            )}
            <div className={typeFlexWrapGap4Sm}>
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
                <p role="status" className={typeSmMuted}>
                  {c.inCollection}
                </p>
              ) : (
                <LibraryCollectionCommandForm
                  actorId={actor.id}
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
