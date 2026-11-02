import { AppError, RESOURCE_RELEASE_WATCH_LIMIT } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../../components/content-catalog-controls";
import { ResourceReleaseWatchBatchControls } from "../../../../../../components/resource-release-watch-batch-controls";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { collectionPageParams } from "../../../../../../lib/library-collections-query";
import { resourceReleaseWatchHistoryCopy } from "../../../../../../lib/resource-release-watch-history-i18n";
import { resourceReleaseWatchesCopy } from "../../../../../../lib/resource-release-watches-i18n";
import { resourceReleaseWatchesQuery } from "../../../../../../lib/resource-release-watches-query";
import { authService } from "../../../../../../lib/services/auth-service";
import { resourceReleaseWatchesService } from "../../../../../../lib/services/resource-release-watches-service";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
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
  const copy = resourceReleaseWatchesCopy(locale);
  const base = `/workspace/library/collections/${encodeURIComponent(path.id)}/watches`;
  if (!actor) {
    let returnPath = base;
    try {
      const preview = resourceReleaseWatchesQuery(collectionPageParams(raw));
      returnPath = `${base}?${new URLSearchParams({
        page: String(preview.page),
        filter: preview.filter,
        query: preview.query,
      })}`;
    } catch {
      // Keep the collection watches route when filters are invalid for guests.
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourceReleaseWatchesQuery>;
  try {
    query = resourceReleaseWatchesQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const result = await resourceReleaseWatchesService
    .collectionPage(actor, path.id, query.page, query.filter, query.query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  const href = (page: number, filter = query.filter) =>
    `${base}?${new URLSearchParams({ page: String(page), filter, query: query.query })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link
        href={`/workspace/library/collections/${encodeURIComponent(path.id)}`}
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.library}
      </Link>
      <h1 className="font-display">{copy.collectionTitle}</h1>
      <h2 className="break-words">{result.collection.name}</h2>
      <p className="text-secondary">
        {copy.note} {copy.pinned}
      </p>
      <p>
        {copy.activeCount}: {result.activeWatchCount}/{RESOURCE_RELEASE_WATCH_LIMIT}
      </p>
      <Link
        href="/workspace/library/watches"
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.watchCenter}
      </Link>
      <Link
        href="/workspace/library/watches/history?source=collection"
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {resourceReleaseWatchHistoryCopy(locale).title}
      </Link>
      {result.collection.status === "archived" && <p role="note">{copy.archivedCollection}</p>}
      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="filter" value={query.filter} />
        <label className="grid gap-1">
          {copy.search}
          <input
            name="query"
            defaultValue={query.query}
            maxLength={100}
            className="border border-base bg-inset px-3 py-2"
          />
        </label>
        <Button type="submit" variant="outline">
          {copy.search}
        </Button>
      </form>
      <nav className="flex flex-wrap gap-4" aria-label={copy.collectionTitle}>
        {(["all", "enabled", "disabled", "unavailable"] as const).map((filter) => (
          <Link
            key={filter}
            href={href(1, filter)}
            aria-current={filter === query.filter ? "page" : undefined}
            className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy[filter]} ({result.counts[filter]})
          </Link>
        ))}
      </nav>
      <ResourceReleaseWatchBatchControls
        key={JSON.stringify([
          path.id,
          result.collection.revision,
          result.items.map((item) => [item.productId, item.revision, item.enabled]),
        ])}
        locale={locale}
        collection={result.collection}
        activeWatchCount={result.activeWatchCount}
        items={result.items.map(({ productId, revision, enabled, available, title }) => ({
          productId,
          revision,
          enabled,
          available,
          title: available ? title : null,
        }))}
      />
      {!result.items.length && (
        <div className="nexus-panel space-y-3 p-6 text-sm text-muted" role="status">
          <p>{result.counts.all === 0 ? copy.empty : copy.emptyFiltered}</p>
          {result.counts.all !== 0 ? (
            <Link
              href={href(1, "all")}
              className="inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.reset}
            </Link>
          ) : null}
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {result.items.map((item) => (
          <li key={item.productId} className="nexus-panel space-y-3 p-5">
            <h3>{item.available ? (item.title ?? copy.privateResource) : copy.privateResource}</h3>
            <p>
              {item.enabled ? copy.enabled : copy.disabled}
              {!item.available ? ` · ${copy.unavailable}` : ""}
            </p>
            {item.available && (
              <Link
                href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {copy.versions}
              </Link>
            )}
          </li>
        ))}
      </ul>
      {result.totalPages > 1 && (
        <nav className="flex gap-4" aria-label={copy.page}>
          {result.page > 1 && <Link href={href(result.page - 1)}>{copy.previous}</Link>}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && <Link href={href(result.page + 1)}>{copy.next}</Link>}
        </nav>
      )}
    </div>
  );
}
