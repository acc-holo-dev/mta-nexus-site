import { EmptyState, ErrorState, PageHeader } from "@nexus/ui";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { ArticleCard } from "../../components/article-card";
import {
  ContentCatalogControls,
  ContentPageNavigation,
} from "../../components/content-catalog-controls";
import { discoveryStreamCopy } from "../../lib/discovery-stream-copy";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { contentService } from "../../lib/services/content-service";
import {
  contentPageHref,
  editorialTypes,
  parseContentPage,
} from "../../lib/user-platform-contract";
import { getUserPlatformCopy } from "../../lib/user-platform-copy";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const copy = getDictionary(await getRequestLocale()).articles;
  return { title: copy.title, description: copy.description };
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const platformCopy = getUserPlatformCopy(locale);
  const { status: _status, ...filters } = parseContentPage((await searchParams) ?? {});
  const result = await contentService.pageArticles(filters).catch(() => null);
  const articles = result?.items ?? [];
  const filtersActive = Boolean(filters.query || filters.type);

  return (
    <div className="min-w-0 space-y-8 overflow-x-clip">
      <PageHeader
        title={dictionary.articles.title}
        description={dictionary.articles.description}
        icon={<BookOpen className="h-7 w-7 text-warning" aria-hidden="true" />}
        action={
          <>
            <Link
              href="/workspace/content/new"
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {platformCopy.create}
            </Link>
            <Link
              href="/workspace/content"
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {platformCopy.studio}
            </Link>
          </>
        }
      />
      <ContentCatalogControls
        path="/articles"
        filters={filters}
        locale={locale}
        types={editorialTypes}
      />

      {!result ? (
        <ErrorState
          title={platformCopy.unavailable}
          action={
            <Link
              href={contentPageHref("/articles", filters, filters.page)}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={filtersActive ? dictionary.articles.emptyFiltered : dictionary.articles.empty}
          description={
            filtersActive ? dictionary.articles.clearFilters : dictionary.home.updatesDescription
          }
          icon={<BookOpen className="h-6 w-6" />}
          action={
            filtersActive ? (
              <Link
                href="/articles"
                className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {dictionary.articles.clearFilters}
              </Link>
            ) : (
              <Link
                href="/discover/stream"
                className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {discoveryStreamCopy(locale).title}
              </Link>
            )
          }
        />
      )}
      {result && (
        <ContentPageNavigation
          path="/articles"
          filters={filters}
          page={result.page}
          hasMore={result.hasMore}
          locale={locale}
        />
      )}
    </div>
  );
}
