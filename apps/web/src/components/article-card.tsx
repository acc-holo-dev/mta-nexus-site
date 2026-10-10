import { safeExternalWebUrl } from "@nexus/validation";
import Link from "next/link";
import { Calendar, MessageSquare, ThumbsUp } from "lucide-react";
import type { Content } from "@nexus/domain";
import { getDictionary, type Locale } from "../lib/i18n";
import { getUserPlatformCopy } from "../lib/user-platform-copy";

export function ArticleCard({
  article,
  locale = "en",
}: {
  article: Content;
  locale?: Locale;
}) {
  const coverImageUrl = safeExternalWebUrl(article.coverImageUrl);
  const dictionary = getDictionary(locale);
  const copy = dictionary.articles;
  const formattedDate = new Date(article.createdAt).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group flex flex-col overflow-hidden nexus-panel transition-all hover:border-strong hover:shadow-nexus"
    >
      {coverImageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-inset">
          {/* biome-ignore lint/performance/noImgElement: article-controlled remote media intentionally bypasses Next image optimization trust. */}
          <img
            src={coverImageUrl}
            alt={article.title}
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {article.type === "review" ? locale === "ru" ? "Обзор" : "Review" : getUserPlatformCopy(locale)[article.type]}
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center gap-2 font-caption text-faint">
          <Calendar className="h-3 w-3" aria-hidden="true" />
          <span>{formattedDate}</span>
          <span aria-hidden="true">•</span>
          <span className="font-numeric">
            {article.viewCount} {copy.views}
          </span>
        </div>

        <h3 className="line-clamp-2 text-xs font-heading text-primary transition-colors group-hover:text-accent">
          {article.title}
        </h3>

        <p className="line-clamp-2 flex-1 font-caption text-muted">
          {article.excerpt || article.body}
        </p>

        <div className="flex items-center justify-between border-t border-base pt-2.5 font-caption">
          <div className="flex items-center gap-3 text-muted">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-numeric">{article.likeCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-numeric">{article.commentCount}</span>
            </span>
          </div>
          <span className="font-semibold text-accent group-hover:underline">
            {copy.read} →
          </span>
        </div>
      </div>
    </Link>
  );
}
