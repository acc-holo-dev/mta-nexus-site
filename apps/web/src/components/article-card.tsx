import React from "react";
import Link from "next/link";
import { BookOpen, ThumbsUp, MessageSquare, Calendar } from "lucide-react";
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
      className="group flex flex-col rounded-xl border border-[#232838] bg-[#11131a] hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 transition-all overflow-hidden"
    >
      {article.coverImageUrl && (
        <div className="relative aspect-[16/9] w-full bg-neutral-900 overflow-hidden">
          <img
            src={article.coverImageUrl}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-black shadow">
            {article.type}
          </div>
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 mb-2">
          <Calendar className="w-3 h-3" />
          <span>{formattedDate}</span>
          <span>•</span>
          <span>{article.viewCount} views</span>
        </div>

        <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-2 mb-2">
          {article.title}
        </h3>

        <p className="text-xs text-neutral-400 line-clamp-2 mb-4 flex-1">
          {article.excerpt || article.body}
        </p>

        <div className="flex items-center justify-between pt-3 border-t border-[#1e2230] text-xs text-neutral-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-3.5 h-3.5 text-neutral-400" />
              <span>{article.likeCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
              <span>{article.commentCount}</span>
            </span>
          </div>
          <span className="text-[11px] text-amber-400 group-hover:underline">Read article →</span>
        </div>
      </div>
    </Link>
  );
}
