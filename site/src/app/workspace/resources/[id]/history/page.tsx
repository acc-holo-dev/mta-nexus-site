import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { formatHistoryDate } from "../../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourcePublisherCopy } from "../../../../../lib/resource-publisher-i18n";
import {
  publisherSearchParams,
  resourcePublisherHistoryQuery,
} from "../../../../../lib/resource-publisher-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourcePublisherService } from "../../../../../lib/services/resource-publisher-service";

export const dynamic = "force-dynamic";
const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getResourcePublisherCopy(await getRequestLocale()).history} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, { id }, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getResourcePublisherCopy(locale),
    dictionary = getDictionary(locale);
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    for (const part of Array.isArray(value) ? value : [value]) returnParams.append(key, part);
  }
  const basePath = `/workspace/resources/${encodeURIComponent(id)}/history`;
  const returnQuery = returnParams.toString();
  const returnPath = returnQuery ? `${basePath}?${returnQuery}` : basePath;
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let query: ReturnType<typeof resourcePublisherHistoryQuery>;
  try {
    query = resourcePublisherHistoryQuery(publisherSearchParams(raw));
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const result = await resourcePublisherService
    .history(actor, id, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && error.statusCode === 404) notFound();
      return null;
    });
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const href = (page: number, kind = query.kind) =>
    `?${new URLSearchParams({ kind, page: String(page) })}`;
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.history}</h1>
      <p className="break-words text-secondary">{result.product.title}</p>
      <p className="text-sm text-muted">{copy.historyNote}</p>
      <nav className="flex flex-wrap gap-4 text-accent" aria-label={copy.history}>
        {(["all", "changes", "publication"] as const).map((kind) => (
          <Link
            key={kind}
            href={href(1, kind)}
            aria-current={query.kind === kind ? "page" : undefined}
            className="rounded underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy[kind]}
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ol className="space-y-3">
          {result.items.map((event) => (
            <li key={event.id} className="nexus-panel space-y-2 p-4">
              <p>{copy.actions[event.action as keyof typeof copy.actions] ?? event.action}</p>
              {event.status && (
                <p className="text-sm text-secondary">
                  {dictionary.authorResources.statusLabels[
                    event.status as keyof typeof dictionary.authorResources.statusLabels
                  ] ?? event.status}
                </p>
              )}
              {event.metadataReviewRequired ? (
                <ErrorState id="resource-metadata-review-required" title={copy.reviewRequired} />
              ) : null}
              {event.reason && (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {event.reason}
                </p>
              )}
              <time className="text-sm text-muted" dateTime={event.createdAt.toISOString()}>
                {formatHistoryDate(event.createdAt, locale)} UTC
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={query.kind !== "all" ? copy.emptyFiltered : copy.empty}
          description={query.kind !== "all" ? copy.emptyFilteredHint : copy.emptyHint}
          action={
            query.kind !== "all" ? (
              <Link href={href(1, "all")} className={navLinkClass}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 && (
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={copy.page}>
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className={navLinkClass}>
              {copy.previous}
            </Link>
          )}
          <span className="inline-flex min-h-11 items-center">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={href(result.page + 1)} className={navLinkClass}>
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
