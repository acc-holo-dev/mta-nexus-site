import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { authService } from "../../../lib/services/auth-service";
import { resourceActivityService } from "../../../lib/services/resource-activity-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getResourceActivityCopy } from "../../../lib/resource-activity-i18n";
import {
  acquisitionSource,
  acquisitionPage,
  acquisitionHistoryHref,
} from "../../../lib/resource-activity-view";
import { formatHistoryDate } from "../../../lib/commerce-history-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Acquisition history | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function AcquisitionHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; source?: string | string[] }>;
}) {
  const [locale, cookieStore, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    searchParams,
  ]);
  const copy = getResourceActivityCopy(locale);
  const actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  const result = await resourceActivityService.buyerHistory(
    actor,
    acquisitionPage(query.page),
    acquisitionSource(query.source),
  );
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <header className="space-y-3">
        <Link href="/workspace/library" className="text-accent underline">
          {copy.library}
        </Link>
        <h1 className="font-display text-primary">{copy.history}</h1>
        <p className="max-w-3xl text-sm text-secondary" role="note">
          {copy.historyNote}
        </p>
      </header>
      <nav aria-label={copy.source} className="flex flex-wrap gap-3">
        {(["all", "direct", "cart"] as const).map((source) => (
          <Link
            key={source}
            href={acquisitionHistoryHref(source, 1)}
            aria-current={result.filter === source ? "page" : undefined}
            className="rounded-md border border-base px-4 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
          >
            {copy[source]}
          </Link>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <p className="nexus-panel p-6 text-secondary">{copy.empty}</p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2">
          {result.items.map((item) => (
            <li key={item.id} className="nexus-panel space-y-3 p-5">
              <h2 className="break-words text-base font-semibold">
                {item.downloadable ? item.title : copy.hidden}
              </h2>
              <p className="text-sm text-secondary">{copy[item.source]}</p>
              <p className="text-xs text-muted">
                {copy.acquiredAt}{" "}
                <time dateTime={item.acquiredAt.toISOString()}>
                  {formatHistoryDate(item.acquiredAt, locale)}
                </time>
              </p>
              <p className="text-sm">
                {!item.hasCurrentAccess
                  ? copy.accessRemoved
                  : item.downloadable
                    ? copy.ready
                    : copy.unavailable}
              </p>
              {item.downloadable && item.slug ? (
                <Link
                  href={`/market/${item.slug}`}
                  className="inline-block text-sm text-accent underline"
                >
                  {copy.open}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-muted">
        {copy.showing} {result.items.length} {copy.of} {result.total}
      </p>
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={acquisitionHistoryHref(result.filter, result.page - 1)}
              className="text-accent underline"
            >
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={acquisitionHistoryHref(result.filter, result.page + 1)}
              className="text-accent underline"
            >
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
