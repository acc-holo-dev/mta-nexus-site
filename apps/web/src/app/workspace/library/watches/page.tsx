import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../lib/services/auth-service";
import { resourceReleaseWatchesService } from "../../../../lib/services/resource-release-watches-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceReleaseWatchesCopy } from "../../../../lib/resource-release-watches-i18n";
import {
  resourceReleaseWatchesQuery,
  resourceReleaseWatchesUrl,
} from "../../../../lib/resource-release-watches-query";
import { formatHistoryDate } from "../../../../lib/commerce-history-format";
import { ResourceReleaseWatchControl } from "../../../../components/resource-release-watch-control";
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
    copy = resourceReleaseWatchesCopy(locale);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
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
      <section className="space-y-4 py-8">
        <p role="alert">{copy.invalid}</p>
        <Link href="/workspace/library/watches" className="text-accent underline">
          {copy.title}
        </Link>
      </section>
    );
  }
  const result = await resourceReleaseWatchesService.page(user, query.page, query.filter);
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/workspace/library" className="text-sm text-accent underline">
        {copy.library}
      </Link>
      <h1 className="font-display text-primary">{copy.title}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.note}
      </p>
      <p className="text-sm text-secondary">
        {copy.pinned} {copy.limit}
      </p>
      <Link href="/settings" className="text-sm text-accent underline">
        {copy.settings}
      </Link>
      <nav aria-label={copy.title} className="flex flex-wrap gap-3">
        {(["all", "enabled", "disabled", "unavailable"] as const).map((filter) => (
          <Link
            key={filter}
            href={resourceReleaseWatchesUrl(filter)}
            aria-current={query.filter === filter ? "page" : undefined}
            className="rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
          >
            {copy[filter]} ({result.counts[filter]})
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.items.map((watch) => (
            <li key={watch.productId} className="nexus-panel space-y-3 p-5">
              <h2 className="break-words font-semibold text-primary">
                {watch.title ?? copy.privateResource}
              </h2>
              <p className="text-sm text-secondary">
                {watch.enabled ? copy.enabled : copy.disabled}
                {watch.available ? "" : ` · ${copy.unavailable}`}
              </p>
              <p className="text-xs text-muted">
                {copy.updated}:{" "}
                <time dateTime={watch.updatedAt.toISOString()}>
                  {formatHistoryDate(watch.updatedAt, locale)}
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
                  className="inline-block text-sm text-accent underline"
                >
                  {copy.versions}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link
              href={resourceReleaseWatchesUrl(query.filter, result.page - 1)}
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
              href={resourceReleaseWatchesUrl(query.filter, result.page + 1)}
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
