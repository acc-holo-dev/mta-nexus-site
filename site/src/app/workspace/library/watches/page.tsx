import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { ResourceReleaseWatchBatchControls } from "../../../../components/resource-release-watch-batch-controls";
import { ResourceReleaseWatchControl } from "../../../../features/resources/release-watch";
import { formatHistoryDate } from "../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceReleaseWatchHistoryCopy } from "../../../../lib/resource-release-watch-history-i18n";
import { resourceReleaseWatchesCopy } from "../../../../lib/resource-release-watches-i18n";
import {
  resourceReleaseWatchesQuery,
  resourceReleaseWatchesUrl,
} from "../../../../lib/resource-release-watches-query";
import { authService } from "../../../../lib/services/auth-service";
import { resourceReleaseWatchesService } from "../../../../lib/services/resource-release-watches-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const filterNavClass =
  "inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReleaseWatchesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function ReleaseWatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]),
    typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en",
    copy = resourceReleaseWatchesCopy(typedLocale),
    dictionary = getDictionary(typedLocale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) {
    let returnPath = "/workspace/library/watches";
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(raw)) {
        if (Array.isArray(value)) for (const item of value) params.append(key, item);
        else if (value !== undefined) params.append(key, value);
      }
      const parsed = resourceReleaseWatchesQuery(params);
      returnPath = resourceReleaseWatchesUrl(parsed.filter, parsed.page, parsed.query);
    } catch {
      // Keep the list route when filters are invalid for unsigned visitors.
    }
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourceReleaseWatchesQuery>;
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value)) for (const item of value) params.append(key, item);
      else if (value !== undefined) params.append(key, value);
    }
    query = resourceReleaseWatchesQuery(params);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <section className={pageShellClass}>
        <ErrorState
          title={copy.invalid}
          description={copy.invalidDescription}
          action={
            <Link href="/workspace/library/watches" className={navLinkClass}>
              {copy.title}
            </Link>
          }
        />
      </section>
    );
  }
  const result = await resourceReleaseWatchesService
    .page(user, query.page, query.filter, query.query)
    .catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/library" className={navLinkClass}>
          {copy.library}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableDescription}
          action={
            <Link
              href={resourceReleaseWatchesUrl(query.filter, query.page, query.query)}
              className={navLinkClass}
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/library" className={navLinkClass}>
        {copy.library}
      </Link>
      <h1 className="min-w-0 break-words font-display text-primary">{copy.title}</h1>
      <Link href="/workspace/library/watches/history" className={navLinkClass}>
        {resourceReleaseWatchHistoryCopy(typedLocale).title}
      </Link>
      <p role="note" className="text-sm text-secondary">
        {copy.note}
      </p>
      <p className="text-sm text-secondary">
        {copy.pinned} {copy.limit}
      </p>
      <Link href="/settings" className={navLinkClass}>
        {copy.settings}
      </Link>
      <form className="flex min-w-0 flex-wrap items-end gap-3">
        <input type="hidden" name="filter" value={query.filter} />
        <label className="grid gap-1">
          {copy.search}
          <input
            name="query"
            defaultValue={query.query}
            maxLength={100}
            className="min-h-11 rounded-md border border-base bg-inset px-3 py-2"
          />
        </label>
        <Button type="submit" variant="outline" size="touch">
          {copy.search}
        </Button>
      </form>
      <a
        className={navLinkClass}
        href={`/api/library/watches/export?${new URLSearchParams({ filter: query.filter, page: String(result.page), query: query.query })}`}
      >
        {copy.export}
      </a>
      <p className="text-sm text-secondary">
        {copy.activeCount}: {result.activeWatchCount ?? 0} / 100
      </p>
      <ResourceReleaseWatchBatchControls
        resume
        activeWatchCount={result.activeWatchCount ?? 0}
        locale={typedLocale}
        key={`resume:${JSON.stringify(result.items.map((item) => [item.productId, item.revision, item.enabled, item.available]))}`}
        items={result.items.map(({ productId, enabled, revision, available, title }) => ({
          productId,
          enabled,
          revision,
          available,
          title: available ? title : null,
        }))}
      />
      <ResourceReleaseWatchBatchControls
        key={JSON.stringify(
          result.items.map((item) => [item.productId, item.revision, item.enabled]),
        )}
        locale={typedLocale}
        items={result.items.map(({ productId, enabled, revision, available, title }) => ({
          productId,
          enabled,
          revision,
          title: available ? title : null,
        }))}
      />
      <nav aria-label={copy.title} className="flex min-w-0 flex-wrap gap-3">
        {(["all", "enabled", "disabled", "unavailable"] as const).map((filter) => (
          <Link
            key={filter}
            href={resourceReleaseWatchesUrl(filter, 1, query.query)}
            aria-current={query.filter === filter ? "page" : undefined}
            className={filterNavClass}
          >
            {copy[filter]} ({result.counts[filter]})
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ul className="grid min-w-0 gap-4 overflow-x-clip sm:grid-cols-2">
          {result.items.map((watch) => (
            <li key={watch.productId} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
              <h2 className="break-words font-semibold text-primary">
                {watch.available ? (watch.title ?? copy.privateResource) : copy.privateResource}
              </h2>
              <p className="text-sm text-secondary">
                {watch.enabled ? copy.enabled : copy.disabled}
                {watch.available ? "" : ` · ${copy.unavailable}`}
              </p>
              <p className="text-xs text-muted">
                {copy.updated}:{" "}
                <time dateTime={watch.updatedAt.toISOString()}>
                  {formatHistoryDate(watch.updatedAt, typedLocale)}
                </time>
              </p>
              <ResourceReleaseWatchControl
                key={`${watch.productId}:${watch.revision}`}
                watch={{
                  productId: watch.productId,
                  enabled: watch.enabled,
                  revision: watch.revision,
                  updatedAt: watch.updatedAt,
                }}
                available={watch.available}
              />
              {watch.available ? (
                <Link
                  href={`/workspace/library/${encodeURIComponent(watch.productId)}/versions`}
                  className={navLinkClass}
                >
                  {copy.versions}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={result.counts.all === 0 ? copy.empty : copy.emptyFiltered}
          description={result.counts.all === 0 ? copy.emptyHint : copy.emptyFilteredHint}
          action={
            result.counts.all === 0 ? (
              <Link href="/workspace/library" className={navLinkClass}>
                {copy.library}
              </Link>
            ) : (
              <Link href={resourceReleaseWatchesUrl("all", 1, "")} className={navLinkClass}>
                {copy.reset}
              </Link>
            )
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex min-w-0 flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={resourceReleaseWatchesUrl(query.filter, result.page - 1, query.query)}
              className={navLinkClass}
            >
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={resourceReleaseWatchesUrl(query.filter, result.page + 1, query.query)}
              className={navLinkClass}
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
