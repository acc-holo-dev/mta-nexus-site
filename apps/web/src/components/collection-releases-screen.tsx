import { AppError, LIBRARY_RELEASE_FILTERS } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionReleasesCopy } from "../lib/collection-releases-i18n";
import { collectionReleasesQuery } from "../lib/collection-releases-query";
import { getRequestLocale } from "../lib/i18n-server";
import { libraryCollectionInventoryCopy } from "../lib/library-collection-inventory-i18n";
import { collectionInventoryHref } from "../lib/library-collection-inventory-query";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../lib/library-collections-query";
import { librarySelectionBatchesCopy } from "../lib/library-selection-batches-i18n";
import { getResourceReleaseControlCopy } from "../lib/resource-release-control-i18n";
import { resourceReleaseWatchesCopy } from "../lib/resource-release-watches-i18n";
import { authService } from "../lib/services/auth-service";
import { libraryCollectionsService } from "../lib/services/library-collections-service";
import { PlatformSignIn } from "./content-catalog-controls";
import { ResourceDownloadButton } from "./resource-download-button";
export async function CollectionReleasesScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, path, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const cc = libraryCollectionsCopy(locale);
  const releasesBase = `/workspace/library/collections/${encodeURIComponent(path.id)}/releases`;
  if (!actor) {
    let returnPath = releasesBase;
    try {
      const preview = collectionReleasesQuery(collectionPageParams(raw));
      returnPath = `${releasesBase}?${new URLSearchParams({
        page: String(preview.page),
        filter: preview.filter,
        ...(preview.q ? { q: preview.q } : {}),
      })}`;
    } catch {
      // Keep the releases route when filters are invalid for guests.
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof collectionReleasesQuery>;
  try {
    query = collectionReleasesQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const result = await libraryCollectionsService
    .releases(actor, path.id, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  const c = collectionReleasesCopy(locale),
    copy = getResourceReleaseControlCopy(locale);
  const suffix = (page = result.page, filter = result.filter) =>
    new URLSearchParams({
      page: String(page),
      filter,
      ...(result.q ? { q: result.q } : {}),
    }).toString();
  const href = (page: number, filter = result.filter) =>
    `${collectionHref(path.id, "releases")}?${suffix(page, filter)}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link
        href={collectionHref(path.id)}
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {cc.back}
      </Link>
      <h1 className="font-display">{c.title}</h1>
      <h2 className="break-words">{result.collection.name}</h2>
      <p>
        {cc.revision}: {result.collection.revision} · {cc.items}: {result.itemCount}
      </p>
      <p className="text-secondary">{c.note}</p>
      <Link
        href={collectionInventoryHref(path.id, "attention")}
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {libraryCollectionInventoryCopy(locale).versionOverview}
      </Link>
      <Link
        href={`/workspace/library/collections/${encodeURIComponent(path.id)}/watches`}
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {resourceReleaseWatchesCopy(locale).collectionTitle}
      </Link>
      {result.collection.status === "archived" ? (
        <p role="note">{c.archived}</p>
      ) : (
        <Link
          href={collectionHref(path.id, "versions", result.q ? { q: result.q } : {})}
          className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {librarySelectionBatchesCopy(locale).title}
        </Link>
      )}
      <form
        method="get"
        action={collectionHref(path.id, "releases")}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="filter" value={result.filter} />
        <label className="grid gap-1">
          {cc.search}
          <input
            name="q"
            defaultValue={result.q}
            maxLength={80}
            className="border border-base bg-surface p-2"
          />
        </label>
        <Button type="submit" variant="outline">
          {cc.apply}
        </Button>
        {result.q && (
          <Link
            href={collectionHref(path.id, "releases", { filter: result.filter })}
            className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {cc.clear}
          </Link>
        )}
      </form>
      <nav aria-label={c.title} className="flex flex-wrap gap-3">
        {LIBRARY_RELEASE_FILTERS.map((filter) => (
          <Link
            key={filter}
            href={href(1, filter)}
            aria-current={filter === result.filter ? "page" : undefined}
            className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {filter === "updates" ? copy.update_available : copy[filter]} ({result.counts[filter]})
          </Link>
        ))}
      </nav>
      {!result.items.length && <p>{cc.emptyItems}</p>}
      <ol className="grid gap-4 sm:grid-cols-2">
        {result.items.map((item) => {
          const version = item.mode === "fixed" ? item.selectedVersion : item.latestVersion,
            buildId = item.mode === "fixed" ? item.selectedBuildId : item.latestBuildId;
          const downloadable =
            item.hasAccess && ["latest", "pinned", "update_available"].includes(item.state);
          return (
            <li key={item.productId} className="nexus-panel space-y-3 p-5">
              <h3 className="break-words font-semibold">{item.title ?? cc.unavailable}</h3>
              <p>{copy[item.state]}</p>
              {item.latestVersion && (
                <p>
                  {copy.latest}: {item.latestVersion}
                </p>
              )}
              {item.mode === "fixed" && item.selectedVersion && (
                <p>
                  {copy.selected}: {item.selectedVersion}
                </p>
              )}
              {downloadable && version && buildId && (
                <ResourceDownloadButton
                  productId={item.productId}
                  version={version}
                  buildId={buildId}
                />
              )}
              {item.hasAccess && item.title !== null && (
                <Link
                  href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                  className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {copy.manage}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <nav aria-label={cc.page} className="flex gap-4">
        {result.page > 1 && (
          <Link
            href={href(result.page - 1)}
            className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {cc.previous}
          </Link>
        )}
        <span>
          {cc.page} {result.page} {cc.of} {result.totalPages}
        </span>
        {result.page < result.totalPages && (
          <Link
            href={href(result.page + 1)}
            className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {cc.next}
          </Link>
        )}
      </nav>
      <p className="text-sm">
        {c.generated}: <time dateTime={result.generatedAt}>{result.generatedAt}</time>
      </p>
      <a
        href={`/api/library/collections/${encodeURIComponent(path.id)}/releases/export?${suffix()}`}
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.export}
      </a>
    </div>
  );
}
