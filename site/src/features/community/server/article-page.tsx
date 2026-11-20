import { followWorkspaceRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { Avatar, ErrorState } from "@nexus/ui";
import { safeExternalWebUrl } from "@nexus/validation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { contentReactionService } from "../../../lib/services/community/content-reaction-service";
import { contentService } from "../../../lib/services/community/content-service";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xlLoose } from "../../shell/page-shell";
import { typeFlexWrapCenterGap2, typeTruncateXsFaint } from "../../shell/type-shell";
import { parseDiscussionQuery } from "../content-discussion-contract";
import { discussionError, getDiscussionCopy } from "../content-discussion-copy";
import { ContentDiscussion } from "../discussion";
import { ContentReactions } from "../reactions";
import { CommunityReportForm } from "../report-form";
import { getUserPlatformCopy } from "../user-platform-copy";

export async function articleDetailMetadata({
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

export async function ArticleDetailPage({
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
  let sessionFailed = false;
  const viewer = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      sessionFailed = true;
      return null;
    });
  const articlePath = `/articles/${encodeURIComponent(article.slug)}`;
  const discussionCopy = getDiscussionCopy(locale);
  const [author, discussion, contentFollow, contentMute, reactions] = await Promise.all([
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
              : discussionCopy.unavailable;
          return null;
        })
      : null,
    viewer
      ? followWorkspaceRepository.contentStates(viewer.id, [article.id]).catch(() => null)
      : Promise.resolve(null),
    viewer
      ? followWorkspaceRepository.muteState(viewer.id, "content", article.id).catch(() => null)
      : Promise.resolve(null),
    sessionFailed
      ? Promise.resolve(null)
      : contentReactionService.state(article.slug, viewer?.id).catch(() => null),
  ]);
  const followRow = Array.isArray(contentFollow)
    ? (contentFollow.find((row) => row.targetId === article.id) ?? null)
    : null;
  const followInitial = sessionFailed
    ? {
        authenticated: null,
        following: false,
        notifyComments: false,
        muted: false,
        mutedUntil: null,
        error: true,
      }
    : viewer
      ? {
          authenticated: true,
          actorId: viewer.id,
          following: Boolean(followRow),
          notifyComments: followRow?.notifyComments === true,
          muted: Boolean(followRow?.mutedUntil ?? contentMute?.mutedUntil),
          mutedUntil: followRow?.mutedUntil ?? contentMute?.mutedUntil ?? null,
          ...(contentFollow === null || (!followRow && contentMute === null)
            ? { error: true }
            : {}),
        }
      : {
          authenticated: false,
          following: false,
          notifyComments: false,
          muted: false,
          mutedUntil: null,
        };
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const formattedDate = new Date(article.createdAt).toLocaleDateString(dateLocale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className={pageShellMax4xlLoose}>
      <Link
        href={isCommunity ? "/community" : "/articles"}
        className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{isCommunity ? getDiscussionCopy(locale).backCommunity : copy.back}</span>
      </Link>

      <header className="space-y-4">
        <div className={typeFlexWrapCenterGap2}>
          <span className="rounded bg-warning-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-warning">
            {getUserPlatformCopy(locale)[article.type]}
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
              <div className={typeTruncateXsFaint}>@{author.username}</div>
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

      {sessionFailed ? (
        <ErrorState
          id="article-session-unavailable"
          title={discussionCopy.identityUnavailable}
          description={discussionCopy.identityUnavailableDescription}
          action={
            <Link href={articlePath} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : viewer?.id !== article.authorId ? (
        <CommunityReportForm
          key={`report:${article.id}:${viewer?.id ?? "guest"}`}
          targetType="content"
          targetId={article.id}
          locale={locale}
          actorId={viewer?.id ?? null}
        />
      ) : null}

      <div className="nexus-panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className={typeFlexWrapCenterGap2}>
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
        key={`reactions:${article.id}:${sessionFailed ? "session-failed" : (viewer?.id ?? "guest")}`}
        contentId={article.id}
        slug={article.slug}
        initial={reactions}
        locale={locale}
      />

      <ContentDiscussion
        title={article.title}
        key={`${article.id}:${sessionFailed ? "session-failed" : (viewer?.id ?? "anonymous")}:${viewer?.role ?? ""}:${filters?.query ?? ""}:${filters?.focusId ?? ""}`}
        viewer={viewer ? { id: viewer.id, canModerate: can(viewer, "admin.moderation") } : null}
        identityUnavailable={sessionFailed}
        slug={article.slug}
        contentId={article.id}
        locale={locale}
        count={article.commentCount}
        initial={discussion}
        followInitial={followInitial}
        initialQuery={filters?.query}
        initialFocus={filters?.focusId}
        initialError={discussionFailure}
      />
    </article>
  );
}
