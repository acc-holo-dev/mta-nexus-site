import { AppError, RESOURCE_RELEASE_WATCH_LIMIT } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceReleaseWatchesService } from "../../../lib/services/resources/resource-release-watches-service";
import { ResourceReleaseWatchControl } from "../../resources/release-watch";
import { ResourceReleaseWatchBatchControls } from "../../resources/release-watch-batch";
import { resourceReleaseWatchHistoryCopy } from "../../resources/resource-release-watch-history-i18n";
import { resourceReleaseWatchesCopy } from "../../resources/resource-release-watches-i18n";
import { resourceReleaseWatchesQuery } from "../../resources/resource-release-watches-query";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { collectionReleasesCopy } from "../collection-releases-i18n";
import { collectionHref, collectionPageParams } from "../library-collections-query";
import { getResourceReleaseControlCopy } from "../resource-release-control-i18n";

export async function collectionWatchesMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReleaseWatchesCopy(await getRequestLocale()).collectionTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function CollectionWatchesScreen({
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
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/workspace/library/collections/"}
      />
    );
  }

  const copy = resourceReleaseWatchesCopy(locale);
  const dictionary = getDictionary(locale);
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
  const href = (page: number, filter = query.filter) =>
    `${base}?${new URLSearchParams({ page: String(page), filter, query: query.query })}`;
  const result = await resourceReleaseWatchesService
    .collectionPage(actor, path.id, query.page, query.filter, query.query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
      return null;
    });
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link
          href={`/workspace/library/collections/${encodeURIComponent(path.id)}`}
          className={linkAccentSmRounded}
        >
          {copy.library}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableDescription}
          action={
            <Link href={href(query.page)} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <Link
        href={`/workspace/library/collections/${encodeURIComponent(path.id)}`}
        className={linkAccentSmRounded}
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
      <Link href="/workspace/library/watches" className={linkAccentSmRounded}>
        {copy.watchCenter}
      </Link>
      <Link href={collectionHref(path.id, "releases")} className={linkAccentSmRounded}>
        {collectionReleasesCopy(locale).title}
      </Link>
      <Link
        href="/workspace/library/watches/history?source=collection"
        className={linkAccentSmRounded}
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
        <Button type="submit" variant="outline" className="min-h-11">
          {copy.search}
        </Button>
      </form>
      <nav className="flex flex-wrap gap-4" aria-label={copy.collectionTitle}>
        {(["all", "enabled", "disabled", "unavailable"] as const).map((filter) => (
          <Link
            key={filter}
            href={href(1, filter)}
            aria-current={filter === query.filter ? "page" : undefined}
            className={linkAccentSmRounded}
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
      {!result.items.length ? (
        <EmptyState
          title={result.counts.all === 0 ? copy.empty : copy.emptyFiltered}
          description={result.counts.all === 0 ? copy.emptyHint : copy.emptyFilteredHint}
          action={
            result.counts.all !== 0 ? (
              <Link href={href(1, "all")} className={linkAccentSmRounded}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.productId} className={panelSpace3P5}>
              <h3>
                {item.available ? (item.title ?? copy.privateResource) : copy.privateResource}
              </h3>
              <p>
                {item.enabled ? copy.enabled : copy.disabled}
                {!item.available ? ` · ${copy.unavailable}` : ""}
              </p>
              <ResourceReleaseWatchControl
                key={`${item.productId}:${item.revision}:${item.enabled}`}
                watch={{
                  productId: item.productId,
                  enabled: item.enabled,
                  revision: item.revision,
                  updatedAt: item.updatedAt,
                }}
                available={item.available}
              />
              <div className="flex flex-wrap gap-4">
                {item.slug ? (
                  <Link
                    href={`/market/${encodeURIComponent(item.slug)}`}
                    className={linkAccentSmRounded}
                  >
                    {getResourceReleaseControlCopy(locale).open}
                  </Link>
                ) : null}
                {item.available && (
                  <Link
                    href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                    className={linkAccentSmRounded}
                  >
                    {copy.versions}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {result.totalPages > 1 && (
        <nav className="flex gap-4" aria-label={copy.page}>
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className={linkAccentSmRounded}>
              {copy.previous}
            </Link>
          )}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={href(result.page + 1)} className={linkAccentSmRounded}>
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
