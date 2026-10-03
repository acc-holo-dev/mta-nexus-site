import { safeExternalWebUrl } from "@nexus/validation";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  MessageSquare,
  ThumbsUp,
} from "lucide-react";
import { Avatar } from "@nexus/ui";
import { contentService } from "../../../lib/services/content-service";
import { authService } from "../../../lib/services/auth-service";
import { ContentCommentForm } from "../../../components/content-comment-form";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const article = await contentService.getArticleBySlug(slug, {
    incrementView: false,
  });

  if (!article) {
    return { title: dictionary.articles.notFound };
  }

  const coverImageUrl = safeExternalWebUrl(article.coverImageUrl);
  return {
    title: article.title,
    description: article.excerpt || article.body.slice(0, 155),
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt || article.body.slice(0, 155),
      type: "article",
      images: coverImageUrl
        ? [{ url: coverImageUrl }]
        : undefined,
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.articles;
  const article = await contentService.getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const coverImageUrl = safeExternalWebUrl(article.coverImageUrl);
  const [author, comments] = await Promise.all([
    authService.getUserById(article.authorId),
    contentService.getComments({ contentId: article.id }, 100),
  ]);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const formattedDate = new Date(article.createdAt).toLocaleDateString(
    dateLocale,
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  );

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <Link
        href="/articles"
        className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{copy.back}</span>
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-warning-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
            {article.type}
          </span>
          <span className="font-numeric text-xs text-muted">
            • {formattedDate}
          </span>
          <span className="font-numeric text-xs text-muted">
            • {article.viewCount} {copy.reads}
          </span>
        </div>

        <h1 className="text-3xl font-black leading-tight text-primary sm:text-4xl">
          {article.title}
        </h1>

        {author && (
          <div className="flex items-center gap-3 pt-2">
            <Avatar
              src={author.avatarUrl || undefined}
              alt={author.displayName}
              fallback={author.displayName || author.username}
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-primary">
                {author.displayName}
              </div>
              <div className="truncate text-xs text-faint">
                @{author.username}
              </div>
            </div>
          </div>
        )}
      </header>

      {coverImageUrl && (
        <div className="aspect-[21/9] w-full overflow-hidden rounded-xl border border-base bg-inset shadow-nexus-sm">
          <img
            src={coverImageUrl}
            alt={article.title}
            width={1120}
            height={480}
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <div className="nexus-panel whitespace-pre-line p-6 text-sm leading-7 text-secondary shadow-nexus-sm sm:p-8">
        {article.body}
      </div>

      <div className="nexus-panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-base bg-inset px-2.5 py-1 text-xs text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div
          className="inline-flex items-center gap-1.5 rounded-lg border border-base bg-inset px-3 py-1.5 text-xs font-semibold text-secondary"
        >
          <ThumbsUp className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
          <span>
            {article.likeCount} {copy.upvotes}
          </span>
        </div>
      </div>

      <section className="nexus-panel space-y-6 p-5 shadow-nexus-sm sm:p-6">
        <h2 className="flex items-center gap-2 font-heading text-primary">
          <MessageSquare className="h-4 w-4 text-warning" aria-hidden="true" />
          <span>
            {copy.discussion} ({comments.length})
          </span>
        </h2>

        <ContentCommentForm slug={article.slug} />

        {comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="space-y-1.5 rounded-lg border border-base bg-inset p-4"
              >
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span className="font-semibold text-secondary">
                    {copy.communityMember}
                  </span>
                  <time
                    dateTime={new Date(comment.createdAt).toISOString()}
                    className="font-numeric text-[11px]"
                  >
                    {new Date(comment.createdAt).toLocaleDateString(
                      dateLocale,
                    )}
                  </time>
                </div>
                <p className="text-xs leading-relaxed text-secondary">
                  {comment.text}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-faint">{copy.firstComment}</p>
        )}
      </section>
    </article>
  );
}
