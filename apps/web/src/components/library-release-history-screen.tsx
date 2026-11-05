import { AppError, LIBRARY_RELEASE_HISTORY_DAYS } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { collectionPageParams } from "../lib/library-collections-query";
import { libraryReleaseHistoryCopy } from "../lib/library-release-history-i18n";
import { libraryReleaseHistoryQuery } from "../lib/library-release-history-query";
import { authService } from "../lib/services/auth-service";
import { libraryReleaseService } from "../lib/services/resource-release-control-service";
import { PlatformSignIn } from "./platform-sign-in";
export async function LibraryReleaseHistoryScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const dictionary = getDictionary(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    let returnPath = "/workspace/library/version-history";
    try {
      const preview = libraryReleaseHistoryQuery(collectionPageParams(raw));
      returnPath = `${returnPath}?${new URLSearchParams({
        page: String(preview.page),
        days: String(preview.days),
        ...(preview.productId ? { productId: preview.productId } : {}),
      })}`;
    } catch {
      // Keep the history route when filters are invalid for unsigned visitors.
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof libraryReleaseHistoryQuery>;
  try {
    query = libraryReleaseHistoryQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const c = libraryReleaseHistoryCopy(locale);
  const retryHref = `/workspace/library/version-history?${new URLSearchParams({
    page: String(query.page),
    days: String(query.days),
    ...(query.productId ? { productId: query.productId } : {}),
  })}`;
  const result = await libraryReleaseService.history(actor, query).catch((error: unknown) => {
    if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link
          href="/workspace/library"
          className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {c.back}
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
  const suffix = (page: number) =>
    new URLSearchParams({
      page: String(page),
      days: String(result.days),
      ...(result.productId ? { productId: result.productId } : {}),
    }).toString();
  const href = (page: number) => `/workspace/library/version-history?${suffix(page)}`;
  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
      <Link
        href="/workspace/library"
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.back}
      </Link>
      <h1 className="font-display">{c.title}</h1>
      <p className="text-secondary">{c.note}</p>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          {c.days}
          <select name="days" defaultValue={result.days}>
            {LIBRARY_RELEASE_HISTORY_DAYS.map((days) => (
              <option key={days} value={days}>
                {days}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          {c.productId}
          <input
            name="productId"
            defaultValue={result.productId ?? ""}
            maxLength={160}
            pattern="[A-Za-z0-9_-]+"
          />
        </label>
        <Button type="submit" variant="outline" size="touch">
          {c.filter}
        </Button>
      </form>
      {result.productId && (
        <Link
          href={`/workspace/library/version-history?days=${result.days}`}
          className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {c.clear}
        </Link>
      )}
      {!result.items.length && (
        <EmptyState
          title={c.empty}
          description={c.note}
          action={
            result.productId ? (
              <Link
                href={`/workspace/library/version-history?days=${result.days}`}
                className="text-sm font-medium text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {c.clear}
              </Link>
            ) : undefined
          }
        />
      )}
      <ol className="space-y-4">
        {result.items.map((item) => (
          <li key={item.id} className="nexus-panel space-y-3 p-5">
            {item.currentTitle && (
              <h2 className="break-words font-semibold">
                {c.current}: {item.currentTitle}
              </h2>
            )}
            <code className="block break-all text-xs">{item.productId}</code>
            <p>{c[item.source]}</p>
            {item.selection && (
              <>
                <p>
                  {c[item.selection.mode]} · {c.revision}: {item.selection.revision}
                </p>
                {item.selection.buildId && (
                  <p className="break-all">
                    {c.recorded}: <code>{item.selection.buildId}</code>
                    {item.buildVersion && ` (${item.buildVersion})`}
                  </p>
                )}
              </>
            )}
            <p>
              {c.time}:{" "}
              <time dateTime={new Date(item.createdAt).toISOString()}>
                {new Date(item.createdAt).toISOString()}
              </time>
            </p>
            {item.hasCurrentAccess && (
              <Link
                href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {c.manage}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <nav aria-label={c.page} className="flex gap-4">
        {result.page > 1 && <Link href={href(result.page - 1)}>{c.previous}</Link>}
        <span>
          {c.page} {result.page} {c.of} {result.totalPages}
        </span>
        {result.page < result.totalPages && <Link href={href(result.page + 1)}>{c.next}</Link>}
      </nav>
      <a
        href={`/api/library/releases/history/export?${suffix(result.page)}`}
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.export}
      </a>
    </div>
  );
}
