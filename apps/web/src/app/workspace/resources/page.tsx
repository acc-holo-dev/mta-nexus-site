import { AppError, type Product } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { ResourcePublisherFilters } from "../../../components/resource-publisher-filters";
import { getCommercialCopy } from "../../../lib/commercial-i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getResourcePublisherCopy } from "../../../lib/resource-publisher-i18n";
import {
  publisherInventoryTotal,
  publisherSearchParams,
  resourcePublisherQuery,
  resourcePublisherUrl,
} from "../../../lib/resource-publisher-query";
import { authService } from "../../../lib/services/auth-service";
import { resourcePublisherService } from "../../../lib/services/resource-publisher-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Author workspace | MTA NEXUS",
  robots: { index: false, follow: false },
};

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const primaryCtaClass =
  "inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default async function AuthorResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.authorResources;
  const publisherCopy = getResourcePublisherCopy(locale);
  const rawParams = await searchParams;
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
    else if (value !== undefined) returnParams.append(key, value);
  }
  const returnPath = returnParams.size
    ? `/workspace/resources?${returnParams}`
    : "/workspace/resources";
  const user = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!user) {
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourcePublisherQuery>;
  try {
    query = resourcePublisherQuery(publisherSearchParams(rawParams));
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const result = await resourcePublisherService.inventory(user, query).catch(() => null);
  if (!result) {
    return (
      <div className={pageShellClass}>
        <header className="space-y-2">
          <h1 className="font-display text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary">{copy.subtitle}</p>
        </header>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const href = (page: number) => resourcePublisherUrl({ ...query, page });
  const inventoryTotal = publisherInventoryTotal(result.statusCounts);
  const emptyTitle = inventoryTotal === 0 ? copy.empty : copy.emptyFilter;
  const emptyDescription = inventoryTotal === 0 ? copy.emptyHint : copy.emptyFilterHint;
  return (
    <div className={pageShellClass}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-secondary">{copy.subtitle}</p>
        </div>
        <Link href="/workspace/resources/new" className={primaryCtaClass}>
          {dictionary.workspace.publishResource}
        </Link>
      </header>
      <Link href="/subscriptions" className={navLinkClass}>
        {getCommercialCopy(locale).catalog}
      </Link>
      <ResourcePublisherFilters query={query} statusCounts={result.statusCounts} locale={locale} />
      {result.items.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            inventoryTotal > 0 ? (
              <Link href="/workspace/resources" className={navLinkClass}>
                {publisherCopy.reset}
              </Link>
            ) : (
              <Link href="/workspace/resources/new" className={navLinkClass}>
                {dictionary.workspace.publishResource}
              </Link>
            )
          }
        />
      ) : (
        <ul aria-label={copy.title} className="grid gap-4 sm:grid-cols-2">
          {result.items.map((product) => (
            <li key={product.id} className="min-w-0 rounded-lg border border-base bg-surface p-5">
              <Link
                href={`/workspace/resources/${product.id}#publication-readiness`}
                className="break-words text-lg font-semibold text-primary hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {product.title}
              </Link>
              <p className="mt-2 text-sm text-secondary">
                {copy.statusLabels[product.status as Product["status"]]} · {product.currentVersion}
              </p>
              <p className="mt-2 break-words text-sm text-muted">{product.shortDescription}</p>
              <p className="mt-2 text-sm text-secondary">
                {publisherCopy.readiness[product.readiness]} · {publisherCopy.versions}:{" "}
                {product.buildCount}
              </p>
              <p className="mt-2 text-xs text-muted">
                {product.scope === "personal" ? publisherCopy.personal : publisherCopy.organization}
              </p>
              {product.metadataReviewRequired ? (
                <ErrorState
                  id="resource-metadata-review-required"
                  className="mt-2"
                  title={publisherCopy.reviewRequired}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex flex-wrap items-center gap-4 text-sm">
          {result.page > 1 && (
            <Link href={href(result.page - 1)} className={navLinkClass}>
              {copy.previous}
            </Link>
          )}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
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
