import {
  AppError,
  LIBRARY_RELEASE_HISTORY_DAYS,
  RESOURCE_RELEASE_WATCH_HISTORY_SOURCES,
} from "@nexus/domain";
import { Button, EmptyState, Input } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { collectionPageParams } from "../../../../../lib/library-collections-query";
import { resourceReleaseWatchHistoryCopy } from "../../../../../lib/resource-release-watch-history-i18n";
import { resourceReleaseWatchHistoryQuery } from "../../../../../lib/resource-release-watch-history-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";

const selectClass =
  "h-10 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const labelClass = "block font-label uppercase text-secondary";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) notFound();
  let query: ReturnType<typeof resourceReleaseWatchHistoryQuery>;
  try {
    query = resourceReleaseWatchHistoryQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const result = await resourceReleaseWatchesService
    .history(actor, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  const c = resourceReleaseWatchHistoryCopy(locale),
    suffix = (page: number) =>
      new URLSearchParams({
        page: String(page),
        days: String(result.days),
        source: result.source,
        ...(result.productId ? { productId: result.productId } : {}),
      }).toString();
  const href = (page: number) => `/workspace/library/watches/history?${suffix(page)}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/workspace/library/watches" className="text-accent underline">
        {c.back}
      </Link>
      <h1 className="font-display">{c.title}</h1>
      <p className="text-secondary">{c.note}</p>
      <form method="get" className="nexus-panel flex flex-wrap items-end gap-4 p-4">
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
        <Button type="submit" variant="secondary">
          {c.filter}
        </Button>
      </form>
      <a
        href={`/api/library/watches/history/export?${suffix(result.page)}`}
        className="text-accent underline"
      >
        {c.export}
      </a>
      {!result.items.length && <EmptyState title={c.empty} description={c.note} />}
      <ol className="space-y-4">
        {result.items.map((item) => (
          <li key={item.id} className="nexus-panel space-y-3 p-5">
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
              <ul className="space-y-3">
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
                        className="text-accent underline"
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
      {result.totalPages > 1 && (
        <nav aria-label={c.page} className="flex gap-4">
          {result.page > 1 && <Link href={href(result.page - 1)}>{c.previous}</Link>}
          <span>
            {c.page} {result.page} {c.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && <Link href={href(result.page + 1)}>{c.next}</Link>}
        </nav>
      )}
    </div>
  );
}
