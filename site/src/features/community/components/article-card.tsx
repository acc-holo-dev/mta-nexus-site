import type { Content } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import { Calendar, MessageSquare, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/i18n";
import {
  typeClamp2CaptionMuted,
  typeCoverHoverScale,
  typeFlex1ColGap2P35,
} from "../../shell/type-shell";
import { getUserPlatformCopy } from "../user-platform-copy";

export function ArticleCard({ article, locale = "en" }: { article: Content; locale?: Locale }) {
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
      className="group flex flex-col overflow-hidden nexus-panel transition-all hover:border-strong hover:shadow-nexus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
            className={typeCoverHoverScale}
          />
          <div className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {getUserPlatformCopy(locale)[article.type]}
          </div>
        </div>
      )}

      <div className={typeFlex1ColGap2P35}>
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

        <p className={typeClamp2CaptionMuted}>{article.excerpt || article.body}</p>

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
          <span className="font-semibold text-accent group-hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]">
            {copy.read} →
          </span>
        </div>
      </div>
    </Link>
  );
}
