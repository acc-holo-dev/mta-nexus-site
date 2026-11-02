import { AppError, type Product } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authEntryHref } from "../../../components/auth-return-path";
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

export default async function AuthorResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.authorResources;
  const rawParams = await searchParams;
  const user = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!user) {
    const returnParams = new URLSearchParams();
    for (const [key, value] of Object.entries(rawParams)) {
      if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
      else if (value !== undefined) returnParams.append(key, value);
    }
    const returnPath = returnParams.size
      ? `/workspace/resources?${returnParams}`
      : "/workspace/resources";
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <Link href={authEntryHref("login", returnPath)} className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  }
  let query: ReturnType<typeof resourcePublisherQuery>;
  try {
    query = resourcePublisherQuery(publisherSearchParams(rawParams));
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const result = await resourcePublisherService.inventory(user, query);
  const publisherCopy = getResourcePublisherCopy(locale);
  const href = (page: number) => resourcePublisherUrl({ ...query, page });
  const inventoryTotal = publisherInventoryTotal(result.statusCounts);
  const emptyMessage = inventoryTotal === 0 ? copy.empty : copy.emptyFilter;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-secondary">{copy.subtitle}</p>
        </div>
        <Link
          href="/workspace/resources/new"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          {dictionary.workspace.publishResource}
        </Link>
      </header>
      <Link href="/subscriptions" className="inline-block text-sm text-accent underline">
        {getCommercialCopy(locale).catalog}
      </Link>
      <ResourcePublisherFilters query={query} statusCounts={result.statusCounts} locale={locale} />
      {result.items.length === 0 ? (
        <p className="py-10 text-secondary">{emptyMessage}</p>
      ) : (
        <ul aria-label={copy.title} className="grid gap-4 sm:grid-cols-2">
          {result.items.map((product) => (
            <li key={product.id} className="min-w-0 rounded-lg border border-base bg-surface p-5">
              <Link
                href={`/workspace/resources/${product.id}#publication-readiness`}
                className="break-words text-lg font-semibold text-primary hover:text-accent"
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
              {product.metadataReviewRequired && (
                <p className="mt-2 text-sm text-warning">{publisherCopy.reviewRequired}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {result.totalPages > 1 && (
        <nav aria-label={copy.page} className="flex items-center gap-4 text-sm">
          {result.page > 1 && (
            <Link
              href={href(result.page - 1)}
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.previous}
            </Link>
          )}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link
              href={href(result.page + 1)}
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
