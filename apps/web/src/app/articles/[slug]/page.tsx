import { safeExternalWebUrl } from "@nexus/validation";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { ContentReactions } from "../../../components/content-reactions";
import { contentReactionService } from "../../../lib/services/content-reaction-service";
import { Avatar } from "@nexus/ui";
import { contentService } from "../../../lib/services/content-service";
import { authService } from "../../../lib/services/auth-service";
import { ContentDiscussion } from "../../../components/content-discussion";
import { getDiscussionCopy } from "../../../lib/content-discussion-copy";
import { discussionError } from "../../../lib/content-discussion-copy";
import { parseDiscussionQuery } from "../../../lib/content-discussion-contract";
import { AppError } from "@nexus/domain";
import { getUserPlatformCopy } from "../../../lib/user-platform-copy";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { cookies } from "next/headers";
import { CommunityReportForm } from "../../../components/community-report-form";
import { can } from "@nexus/security";

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
      images: coverImageUrl ? [{ url: coverImageUrl }] : undefined,
    },
  };
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.articles;
  const article = await contentService.getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const isCommunity = article.type === "post" || article.type === "question";
  const coverImageUrl = safeExternalWebUrl(article.coverImageUrl);
  const requested = (await searchParams) ?? {},
    discussionParams = new URLSearchParams();
  for (const key of ["q", "comment"]) {
    const value = requested[key];
    if (Array.isArray(value)) for (const part of value) discussionParams.append(key, part);
    else if (value !== undefined) discussionParams.set(key, value);
  }
  const filters = parseDiscussionQuery(discussionParams);
  let discussionFailure = filters ? "" : discussionError(locale, "INVALID_CURSOR");
  const [author, discussion, viewer] = await Promise.all([
    authService.getUserById(article.authorId),
    filters
      ? (filters.query || filters.focusId
          ? contentService.pageDiscussion(article.id, undefined, {
              query: filters.query,
              focusId: filters.focusId,
            })
          : contentService.pageDiscussion(article.id)
        ).catch((error: unknown) => {
          discussionFailure =
            error instanceof AppError
              ? discussionError(locale, error.code)
              : getDiscussionCopy(locale).unavailable;
          return null;
        })
      : null,
    authService.getSession((await cookies()).get("nexus_session")?.value).catch(() => null),
  ]);
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const reactions = await contentReactionService.state(article.slug, viewer?.id).catch(() => null);
  const formattedDate = new Date(article.createdAt).toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <Link
        href={isCommunity ? "/community" : "/articles"}
        className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{isCommunity ? getDiscussionCopy(locale).backCommunity : copy.back}</span>
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-warning-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
            {article.type === "review"
              ? locale === "ru"
                ? "Обзор"
                : "Review"
              : getUserPlatformCopy(locale)[article.type]}
          </span>
          <span className="font-numeric text-xs text-muted">• {formattedDate}</span>
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
              <div className="truncate text-sm font-bold text-primary">{author.displayName}</div>
              <div className="truncate text-xs text-faint">@{author.username}</div>
            </div>
          </div>
        )}
      </header>

      {coverImageUrl && (
        <div className="aspect-[21/9] w-full overflow-hidden rounded-xl border border-base bg-inset shadow-nexus-sm">
          {/* biome-ignore lint/performance/noImgElement: user-controlled remote media intentionally bypasses Next image optimization trust. */}
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

      {viewer?.id !== article.authorId && (
        <CommunityReportForm
          key={`${article.id}:${viewer?.id ?? "guest"}`}
          targetType="content"
          targetId={article.id}
          locale={locale}
          authenticated={!!viewer}
        />
      )}

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
      </div>

      <ContentReactions
        key={`${article.id}:${viewer?.id ?? "guest"}`}
        contentId={article.id}
        slug={article.slug}
        initial={reactions}
        locale={locale}
      />

      <ContentDiscussion
        key={`${article.id}:${viewer?.id ?? "anonymous"}:${viewer?.role ?? ""}:${filters?.query ?? ""}:${filters?.focusId ?? ""}`}
        viewer={viewer ? { id: viewer.id, canModerate: can(viewer, "admin.moderation") } : null}
        slug={article.slug}
        contentId={article.id}
        locale={locale}
        count={article.commentCount}
        initial={discussion}
        initialQuery={filters?.query}
        initialFocus={filters?.focusId}
        initialError={discussionFailure}
      />
    </article>
  );
}
