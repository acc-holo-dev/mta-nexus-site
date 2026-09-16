import React from "react";
import Link from "next/link";
import { ThumbsUp, MessageSquare, Calendar } from "lucide-react";
import type { Content } from "@nexus/domain";

export function ArticleCard({ article }: { article: Content }) {
  const formattedDate = new Date(article.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group flex flex-col nexus-panel overflow-hidden hover:border-strong hover:shadow-nexus transition-all"
    >
      {article.coverImageUrl && (
        <div className="relative aspect-[16/9] w-full bg-inset overflow-hidden">
          <img
            src={article.coverImageUrl}
            alt={article.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent text-white">
            {article.type}
          </div>
        </div>
      )}

      <div className="p-3.5 flex flex-col flex-1 gap-2">
        <div className="flex items-center gap-2 font-caption text-faint">
          <Calendar className="w-3 h-3" />
          <span>{formattedDate}</span>
          <span>•</span>
          <span className="font-numeric">{article.viewCount} views</span>
        </div>

        <h3 className="text-xs font-heading text-primary group-hover:text-accent transition-colors line-clamp-2">
          {article.title}
        </h3>

        <p className="font-caption text-muted line-clamp-2 flex-1">
          {article.excerpt || article.body}
        </p>

        <div className="flex items-center justify-between pt-2.5 border-t border-base font-caption">
          <div className="flex items-center gap-3 text-muted">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5" />
              <span className="font-numeric">{article.likeCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-numeric">{article.commentCount}</span>
            </span>
          </div>
          <span className="text-accent group-hover:underline font-semibold">Read →</span>
        </div>
      </div>
    </Link>
  );
}
