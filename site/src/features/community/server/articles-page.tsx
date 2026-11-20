import { EmptyState, ErrorState, PageHeader } from "@nexus/ui";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { contentService } from "../../../lib/services/community/content-service";
import { discoveryStreamCopy } from "../../discovery/discovery-stream-copy";
import { linkAccentSm, linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellStack8 } from "../../shell/page-shell";
import { ArticleCard } from "../article-view";
import { ContentCatalogControls, ContentPageNavigation } from "../catalog-controls";
import { contentPageHref, editorialTypes, parseContentPage } from "../user-platform-contract";
import { getUserPlatformCopy } from "../user-platform-copy";

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
    <div className={pageShellStack8}>
      <PageHeader
        title={dictionary.articles.title}
        description={dictionary.articles.description}
        icon={<BookOpen className="h-7 w-7 text-warning" aria-hidden="true" />}
        action={
          <>
            <Link href="/workspace/content/new" className={linkAccentSm}>
              {platformCopy.create}
            </Link>
            <Link href="/workspace/content" className={linkAccentSm}>
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
          description={platformCopy.unavailableHint}
          action={
            <Link
              href={contentPageHref("/articles", filters, filters.page)}
              className={linkAccentSmRounded}
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
              <Link href="/articles" className={linkAccentSm}>
                {dictionary.articles.clearFilters}
              </Link>
            ) : (
              <Link href="/discover/stream" className={linkAccentSm}>
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
