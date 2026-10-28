import { BookOpen } from "lucide-react";
import { EmptyState } from "@nexus/ui";
import { ArticleCard } from "../../components/article-card";
import { contentService } from "../../lib/services/content-service";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import Link from "next/link";
import {
  ContentCatalogControls,
  ContentPageNavigation,
} from "../../components/content-catalog-controls";
import { editorialTypes, parseContentPage } from "../../lib/user-platform-contract";
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

  return (
    <div className="space-y-8">
      <div className="border-b border-base pb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-primary sm:text-3xl">
          <BookOpen className="h-7 w-7 text-warning" aria-hidden="true" />
          <span>{dictionary.articles.title}</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          {dictionary.articles.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/workspace/content/new" className="text-accent underline">
          {platformCopy.create}
        </Link>
        <Link href="/workspace/content" className="text-accent underline">
          {platformCopy.studio}
        </Link>
      </div>
      <ContentCatalogControls
        path="/articles"
        filters={filters}
        locale={locale}
        types={editorialTypes}
      />

      {!result ? (
        <p role="alert" className="text-sm text-danger">
          {platformCopy.unavailable}
        </p>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} locale={locale} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={dictionary.articles.empty}
          description={dictionary.home.updatesDescription}
          icon={<BookOpen className="h-6 w-6" />}
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
