import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { contentService } from "../../../lib/services/content-service";
import { authService } from "../../../lib/services/auth-service";
import { Calendar, Eye, ThumbsUp, MessageSquare, ArrowLeft, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Metadata generation must not count as a second article view.
  const article = await contentService.getArticleBySlug(slug, { incrementView: false });

  if (!article) {
    return { title: "Article not found" };
  }

  return {
    title: article.title,
    description: article.excerpt || article.body.slice(0, 155),
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt || article.body.slice(0, 155),
      type: "article",
      images: article.coverImageUrl ? [{ url: article.coverImageUrl }] : undefined,
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await contentService.getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const author = await authService.getUserById(article.authorId);
  const comments = await contentService.getComments({ contentId: article.id }, 100);

  const formattedDate = new Date(article.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <Link
        href="/articles"
        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Articles</span>
      </Link>

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500 text-black">
            {article.type}
          </span>
          <span className="text-xs text-neutral-400 font-mono">• {formattedDate}</span>
          <span className="text-xs text-neutral-400 font-mono">• {article.viewCount} reads</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
          {article.title}
        </h1>

        {/* Author info */}
        {author && (
          <div className="flex items-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 border border-neutral-700">
              <img
                src={author.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${author.username}`}
                alt={author.displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{author.displayName}</div>
              <div className="text-xs text-neutral-500">@{author.username}</div>
            </div>
          </div>
        )}
      </div>

      {/* Cover Image */}
      {article.coverImageUrl && (
        <div className="aspect-[21/9] w-full rounded-xl overflow-hidden border border-base">
          <img
            src={article.coverImageUrl}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Body Content */}
      <div className="p-8 rounded-xl border border-base bg-surface prose prose-invert max-w-none text-neutral-200 text-sm leading-relaxed whitespace-pre-line space-y-4 font-sans">
        {article.body}
      </div>

      {/* Tags & Reactions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-base bg-surface">
        <div className="flex flex-wrap items-center gap-2">
          {article.tags.map((t) => (
            <span
              key={t}
              className="px-2.5 py-1 rounded bg-neutral-900 border border-base text-xs text-neutral-400"
            >
              #{t}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-base text-xs font-semibold text-neutral-300">
            <ThumbsUp className="w-3.5 h-3.5 text-amber-400" />
            <span>{article.likeCount} Upvotes</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <div className="p-6 rounded-xl border border-base bg-surface space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span>Discussion & Comments ({comments.length})</span>
        </h3>

        {comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-lg bg-neutral-900 border border-base space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold text-neutral-200">Community Member</span>
                  <span className="font-mono text-[11px]">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-500">Be the first to leave a comment on this article.</p>
        )}
      </div>
    </article>
  );
}
