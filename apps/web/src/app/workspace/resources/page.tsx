import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { AppError, type Product } from "@nexus/domain";
import { authService } from "../../../lib/services/auth-service";
import { resourcePublisherService } from "../../../lib/services/resource-publisher-service";
import { ResourcePublisherFilters } from "../../../components/resource-publisher-filters";
import {
  resourcePublisherQuery,
  resourcePublisherUrl,
  publisherSearchParams,
} from "../../../lib/resource-publisher-query";
import { getResourcePublisherCopy } from "../../../lib/resource-publisher-i18n";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getCommercialCopy } from "../../../lib/commercial-i18n";

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
  const user = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  let query: ReturnType<typeof resourcePublisherQuery>;
  try {
    query = resourcePublisherQuery(publisherSearchParams(await searchParams));
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const result = await resourcePublisherService.inventory(user, query);
  const publisherCopy = getResourcePublisherCopy(locale);
  const href = (page: number) => resourcePublisherUrl({ ...query, page });
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
        <p className="py-10 text-secondary">{copy.empty}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.items.map((product) => (
            <li key={product.id} className="min-w-0 rounded-lg border border-base bg-surface p-5">
              <Link
                href={`/workspace/resources/${product.id}`}
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
            <Link href={href(result.page - 1)} className="text-accent underline">
              {copy.previous}
            </Link>
          )}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages && (
            <Link href={href(result.page + 1)} className="text-accent underline">
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
