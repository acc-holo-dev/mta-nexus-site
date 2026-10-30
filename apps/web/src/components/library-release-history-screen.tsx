import { AppError, LIBRARY_RELEASE_HISTORY_DAYS } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../lib/i18n-server";
import { collectionPageParams } from "../lib/library-collections-query";
import { libraryReleaseHistoryCopy } from "../lib/library-release-history-i18n";
import { libraryReleaseHistoryQuery } from "../lib/library-release-history-query";
import { authService } from "../lib/services/auth-service";
import { libraryReleaseService } from "../lib/services/resource-release-control-service";
export async function LibraryReleaseHistoryScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) notFound();
  let query: ReturnType<typeof libraryReleaseHistoryQuery>;
  try {
    query = libraryReleaseHistoryQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const result = await libraryReleaseService.history(actor, query).catch((error: unknown) => {
    if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
    throw error;
  });
  const c = libraryReleaseHistoryCopy(locale);
  const suffix = (page: number) =>
    new URLSearchParams({
      page: String(page),
      days: String(result.days),
      ...(result.productId ? { productId: result.productId } : {}),
    }).toString();
  const href = (page: number) => `/workspace/library/version-history?${suffix(page)}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/workspace/library" className="text-accent underline">
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
        <Button type="submit" variant="outline">
          {c.filter}
        </Button>
      </form>
      {result.productId && (
        <Link
          href={`/workspace/library/version-history?days=${result.days}`}
          className="text-accent underline"
        >
          {c.clear}
        </Link>
      )}
      {!result.items.length && <p>{c.empty}</p>}
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
                className="text-accent underline"
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
        className="text-accent underline"
      >
        {c.export}
      </a>
    </div>
  );
}
