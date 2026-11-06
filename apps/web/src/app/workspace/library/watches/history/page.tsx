import {
  AppError,
  LIBRARY_RELEASE_HISTORY_DAYS,
  RESOURCE_RELEASE_WATCH_HISTORY_SOURCES,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState, Input } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { collectionPageParams } from "../../../../../lib/library-collections-query";
import { resourceReleaseWatchHistoryCopy } from "../../../../../lib/resource-release-watch-history-i18n";
import { resourceReleaseWatchHistoryQuery } from "../../../../../lib/resource-release-watch-history-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const selectClass =
  "min-h-11 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const labelClass = "block font-label uppercase text-secondary";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const dictionary = getDictionary(typedLocale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    let returnPath = "/workspace/library/watches/history";
    try {
      const preview = resourceReleaseWatchHistoryQuery(collectionPageParams(raw));
      returnPath = `${returnPath}?${new URLSearchParams({
        page: String(preview.page),
        days: String(preview.days),
        source: preview.source,
        ...(preview.productId ? { productId: preview.productId } : {}),
      })}`;
    } catch {
      // Keep the history route when filters are invalid for unsigned visitors.
    }
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourceReleaseWatchHistoryQuery>;
  try {
    query = resourceReleaseWatchHistoryQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const retryHref = `/workspace/library/watches/history?${new URLSearchParams({
    page: String(query.page),
    days: String(query.days),
    source: query.source,
    ...(query.productId ? { productId: query.productId } : {}),
  })}`;
  const result = await resourceReleaseWatchesService
    .history(actor, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
      return null;
    });
  const c = resourceReleaseWatchHistoryCopy(typedLocale);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/library/watches" className={navLinkClass}>
          {c.back}
        </Link>
        <ErrorState
          id="library-watches-history-load-unavailable"
          title={c.loadUnavailable}
          description={c.loadUnavailableDescription}
          action={
            <Link href={retryHref} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const suffix = (page: number) =>
    new URLSearchParams({
      page: String(page),
      days: String(result.days),
      source: result.source,
      ...(result.productId ? { productId: result.productId } : {}),
    }).toString();
  const href = (page: number) => `/workspace/library/watches/history?${suffix(page)}`;
  const filtered = result.source !== "all" || Boolean(result.productId) || result.days !== 30;
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/library/watches" className={navLinkClass}>
        {c.back}
      </Link>
      <h1 className="min-w-0 break-words font-display">{c.title}</h1>
      <p className="text-secondary">{c.note}</p>
      <form
        method="get"
        className="nexus-panel flex min-w-0 flex-wrap items-end gap-4 overflow-x-clip p-4"
      >
        <label className="min-w-0 flex-1 space-y-1.5 text-sm text-secondary">
          <span className={labelClass}>{c.days}</span>
          <select name="days" className={selectClass} defaultValue={result.days}>
            {LIBRARY_RELEASE_HISTORY_DAYS.map((days) => (
              <option key={days} value={days}>
                {days}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 space-y-1.5 text-sm text-secondary">
          <span className={labelClass}>{c.source}</span>
          <select name="source" className={selectClass} defaultValue={result.source}>
            {RESOURCE_RELEASE_WATCH_HISTORY_SOURCES.map((source) => (
              <option key={source} value={source}>
                {c[source]}
              </option>
            ))}
          </select>
        </label>
        <div className="min-w-0 flex-1">
          <Input
            name="productId"
            defaultValue={result.productId ?? ""}
            maxLength={160}
            pattern="[A-Za-z0-9_-]+"
            label={c.productId}
          />
        </div>
        <Button type="submit" variant="secondary" size="touch">
          {c.filter}
        </Button>
        <Link href="/workspace/library/watches/history" className={navLinkClass}>
          {c.clear}
        </Link>
      </form>
      <a
        href={`/api/library/watches/history/export?${suffix(result.page)}`}
        className={navLinkClass}
      >
        {c.export}
      </a>
      {!result.items.length ? (
        <EmptyState
          title={c.empty}
          description={c.emptyHint}
          action={
            filtered ? (
              <Link href="/workspace/library/watches/history" className={navLinkClass}>
                {c.clear}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {result.items.length ? (
        <ol className="min-w-0 space-y-4 overflow-x-clip">
          {result.items.map((item) => (
            <li key={item.id} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
              <h2>{c[item.source]}</h2>
              <p>
                {c.time}: <time dateTime={item.createdAt}>{item.createdAt}</time>
              </p>
              {item.collection && (
                <p className="break-all">
                  {c.collectionId}: {item.collection.id} / {item.collection.revision}
                </p>
              )}
              {item.changes && (
                <ul className="min-w-0 space-y-3 overflow-x-clip">
                  {item.changes.map((change) => (
                    <li key={change.productId} className="space-y-2 border-t border-base pt-3">
                      {change.currentAvailable && change.currentTitle && (
                        <h3 className="break-words">
                          {c.current}: {change.currentTitle}
                        </h3>
                      )}
                      <code className="break-all text-xs">{change.productId}</code>
                      <p>
                        {change.enabled ? c.enabled : c.disabled} · {c.revision}: {change.revision}
                      </p>
                      <p>
                        {c.currentWatch}:{" "}
                        {change.currentWatch
                          ? change.currentWatch.enabled
                            ? c.enabled
                            : c.disabled
                          : c.noCurrentWatch}
                      </p>
                      {change.currentAvailable && (
                        <Link
                          href={`/workspace/library/${encodeURIComponent(change.productId)}/versions`}
                          className={navLinkClass}
                        >
                          {c.manage}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : null}
      {result.totalPages > 1 && (
        <nav aria-label={c.page} className="flex min-w-0 flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={navLinkClass}>
              {c.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {c.page} {result.page} {c.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={navLinkClass}>
              {c.next}
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
