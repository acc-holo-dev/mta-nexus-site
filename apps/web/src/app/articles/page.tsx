import { BookOpen } from "lucide-react";
import { EmptyState } from "@nexus/ui";
import { ArticleCard } from "../../components/article-card";
import { contentService } from "../../lib/services/content-service";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const articles = await contentService.listArticles();

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

      {articles.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              locale={locale}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title={dictionary.articles.empty}
          description={dictionary.home.updatesDescription}
          icon={<BookOpen className="h-6 w-6" />}
        />
      )}
    </div>
  );
}
