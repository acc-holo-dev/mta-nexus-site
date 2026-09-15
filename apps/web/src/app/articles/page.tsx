import { contentService } from "../../lib/services/content-service";
import { ArticleCard } from "../../components/article-card";
import Link from "next/link";
import { BookOpen, PenSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const articles = await contentService.listArticles();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232838] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-amber-500" />
            <span>MTA Engineering Hub & Articles</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Technical guides, server administration tutorials, Lua architecture patterns, and release devlogs.
          </p>
        </div>

        <Link
          href="/workspace"
          className="self-start md:self-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-black font-bold text-xs transition-colors"
        >
          <PenSquare className="w-4 h-4" />
          <span>Write Article</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </div>
  );
}
