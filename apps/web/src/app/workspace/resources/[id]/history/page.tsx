import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { authService } from "../../../../../lib/services/auth-service";
import { resourcePublisherService } from "../../../../../lib/services/resource-publisher-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourcePublisherCopy } from "../../../../../lib/resource-publisher-i18n";
import {
  publisherSearchParams,
  resourcePublisherHistoryQuery,
} from "../../../../../lib/resource-publisher-query";
import { getDictionary } from "../../../../../lib/i18n";
import { formatHistoryDate } from "../../../../../lib/commerce-history-format";
export const dynamic = "force-dynamic";
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
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) notFound();
  const copy = getResourcePublisherCopy(locale),
    dictionary = getDictionary(locale);
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
      throw error;
    });
  const href = (page: number, kind = query.kind) =>
    `?${new URLSearchParams({ kind, page: String(page) })}`;
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href={`/workspace/resources/${encodeURIComponent(id)}`}
        className="text-accent underline"
      >
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
            className="underline"
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
              {event.metadataReviewRequired && (
                <p className="text-sm text-warning">{copy.reviewRequired}</p>
              )}
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
        <p>{copy.empty}</p>
      )}
      {result.totalPages > 1 && (
        <nav className="flex gap-4 text-sm" aria-label={copy.page}>
          {result.page > 1 && <Link href={href(result.page - 1)}>{copy.previous}</Link>}
          <span>
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages && <Link href={href(result.page + 1)}>{copy.next}</Link>}
        </nav>
      )}
    </div>
  );
}
