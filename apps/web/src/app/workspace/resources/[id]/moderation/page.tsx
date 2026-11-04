import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { formatHistoryDate, parseHistoryPage } from "../../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import {
  getResourceReleaseControlCopy,
  resourceModerationLabel,
} from "../../../../../lib/resource-release-control-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { productService } from "../../../../../lib/services/product-service";
import { resourceModerationService } from "../../../../../lib/services/resource-release-control-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Publication restrictions | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function PublisherModerationHistory({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getResourceReleaseControlCopy(locale),
    dictionary = getDictionary(locale),
    returnParams = new URLSearchParams();
  if (query.page !== undefined) {
    for (const part of Array.isArray(query.page) ? query.page : [query.page])
      returnParams.append("page", part);
  }
  const basePath = `/workspace/resources/${encodeURIComponent(id)}/moderation`;
  const returnQuery = returnParams.toString();
  const returnPath = returnQuery ? `${basePath}?${returnQuery}` : basePath;
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const product = await productService.getManagedProduct(id, user);
  if (!product) notFound();
  const result = await resourceModerationService
    .publisherHistory(user, id, Math.min(parseHistoryPage(query.page), 1000))
    .catch((error) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
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
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/resources/${encodeURIComponent(id)}`} className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.moderationHistory}</h1>
      <h2 className="break-words text-xl text-primary">{product.title}</h2>
      <p className="text-secondary">{copy[product.status]}</p>
      {product.status === "suspended" ? (
        <p role="note" className="rounded-md border border-base p-4 text-sm text-secondary">
          {copy.publisherNote}
        </p>
      ) : null}
      {result.events.length ? (
        <ol className="space-y-3">
          {result.events.map((event) => (
            <li key={event.id} className="nexus-panel space-y-3 p-5">
              <h3 className="font-semibold text-primary">
                {resourceModerationLabel(locale, event.action)}
              </h3>
              <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(event.createdAt, locale)}
              </time>
              {event.reason ? (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {event.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title={copy.moderationHistoryEmpty} description={copy.emptyHint} />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={navLinkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={navLinkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
