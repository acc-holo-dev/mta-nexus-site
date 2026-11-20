import { AppError } from "@nexus/domain";
import { can } from "@nexus/security";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "../../../lib/i18n";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { communityModerationService } from "../../../lib/services/community/community-moderation-service";
import { parseModerationDetailQuery } from "../../moderation/community-moderation-contract";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import {
  pageShellMax5xlTight as pageShellClass,
  pageShellMax5xlBare,
} from "../../shell/page-shell";
import { panelSpace3P5, panelSpace4P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { moderationCopy } from "../community-moderation-copy";
import { ModeratedDiscussionRemoval } from "../components/moderated-discussion-removal";
import { discussionReportsHref } from "../discussion-reports-contract";
import { discussionReportsCopy } from "../discussion-reports-copy";
import {
  moderatedDiscussionDetailSchema,
  moderatedDiscussionHref,
  moderatedDiscussionPageSchema,
  parseModeratedDiscussionQuery,
} from "../moderated-discussion-contract";
import { moderatedDiscussionCopy } from "../moderated-discussion-copy";
import { platformFieldClass } from "../user-platform-client";

function ModeratedDiscussionLoadError({
  locale,
  retryHref,
}: {
  locale: Locale;
  retryHref: string;
}) {
  const copy = moderatedDiscussionCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <section className={`nexus-panel space-y-3 p-5 ${pageShellClass}`}>
      <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={linkAccentSm}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function moderatedDiscussionMetadata(): Promise<Metadata> {
  return {
    title: moderatedDiscussionCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export async function ModeratedDiscussionScreen({
  id,
  commentId,
  searchParams,
}: {
  id: string;
  commentId?: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = moderatedDiscussionCopy(locale),
    general = moderationCopy(locale);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const stableHref = `/admin/community/${encodeURIComponent(id)}/discussion${commentId ? `/${encodeURIComponent(commentId)}` : ""}`;
  const href = `${stableHref}${params.size ? `?${params}` : ""}`;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={stableHref}
      />
    );
  }
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={href} />;
  }
  if (!can(actor, "admin.moderation")) {
    const dictionary = getDictionary(locale);
    return (
      <div className={pageShellMax5xlBare}>
        <ErrorState
          title={general.denied}
          description={general.deniedHint}
          action={
            <Link href="/admin" className={linkAccentSm}>
              {dictionary.admin.title}
            </Link>
          }
        />
      </div>
    );
  }
  const filters = commentId
    ? parseModerationDetailQuery(params)
    : parseModeratedDiscussionQuery(params);
  let failure = filters ? "" : general.invalid;
  let loadFailed = false;
  const raw = filters
    ? await (commentId
        ? communityModerationService.discussionDetail(actor, id, commentId, filters.cursor)
        : communityModerationService.discussion(
            actor,
            id,
            filters as NonNullable<ReturnType<typeof parseModeratedDiscussionQuery>>,
          )
      ).catch((error: unknown) => {
        if (error instanceof AppError && error.statusCode === 404) notFound();
        if (error instanceof AppError && (error.statusCode === 403 || error.code === "FORBIDDEN")) {
          failure = general.denied;
          return null;
        }
        loadFailed = true;
        return null;
      })
    : null;
  const parsed = commentId
    ? moderatedDiscussionDetailSchema.safeParse(raw)
    : moderatedDiscussionPageSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.publication.id !== id ||
    ("comment" in parsed.data && parsed.data.comment && parsed.data.comment.id !== commentId)
  ) {
    if (loadFailed) {
      return <ModeratedDiscussionLoadError locale={locale} retryHref={href} />;
    }
    return (
      <div className={pageShellMax5xlBare}>
        <ErrorState
          title={failure || general.unavailable}
          description={copy.loadUnavailableHint}
          action={
            <div className="flex flex-wrap justify-center gap-4">
              <a href={href} className={linkAccentSm}>
                {general.reload}
              </a>
              <Link href={moderatedDiscussionHref(id)} className={linkAccentSm}>
                {copy.back}
              </Link>
            </div>
          }
        />
      </div>
    );
  }
  const data = parsed.data,
    publication = data.publication;
  const listFilters =
    !commentId && filters && "query" in filters
      ? (filters as NonNullable<ReturnType<typeof parseModeratedDiscussionQuery>>)
      : null;
  const emptyFiltered = Boolean(
    listFilters && (listFilters.query || listFilters.author || listFilters.cursor),
  );
  const date = (value: string) => (
    <time dateTime={value}>
      {new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
        timeZone: "UTC",
        timeZoneName: "short",
      })}
    </time>
  );
  const identity = (author: { username: string; name: string } | null) =>
    author ? (
      <Link
        href={`/users/${encodeURIComponent(author.username)}`}
        className="break-words text-accent"
      >
        {author.name} (@{author.username})
      </Link>
    ) : (
      <span>{copy.unknown}</span>
    );
  return (
    <div className={pageShellClass}>
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="break-words font-semibold text-primary">
          {publication.title} · {general[publication.status]}
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href={`/admin/community/${encodeURIComponent(id)}`} className={linkAccentSm}>
            {copy.publication}
          </Link>
          {commentId && (
            <Link href={moderatedDiscussionHref(id)} className={linkAccentSm}>
              {copy.back}
            </Link>
          )}
          {commentId && (
            <Link href={discussionReportsHref(id, commentId)} className={linkAccentSm}>
              {discussionReportsCopy(locale).open}
            </Link>
          )}
        </nav>
      </header>
      {"items" in data ? (
        <>
          <search aria-label={general.search}>
            <form
              action={moderatedDiscussionHref(id)}
              className="nexus-panel grid gap-3 p-5 sm:grid-cols-2"
            >
              <label className="space-y-1 text-sm text-primary">
                <span>{general.search}</span>
                <input
                  className={platformFieldClass}
                  type="search"
                  name="q"
                  maxLength={100}
                  defaultValue={params.get("q") ?? ""}
                />
              </label>
              <label className="space-y-1 text-sm text-primary">
                <span>{general.author}</span>
                <input
                  className={platformFieldClass}
                  name="author"
                  maxLength={128}
                  defaultValue={params.get("author") ?? ""}
                />
              </label>
              <Button className="min-h-11" type="submit">
                {general.apply}
              </Button>
              <Link className={linkAccentSm} href={moderatedDiscussionHref(id)}>
                {general.reset}
              </Link>
            </form>
          </search>
          {data.items.length ? (
            <ul className="space-y-3">
              {data.items.map((item) => (
                <li key={item.id} className={panelSpace3P5}>
                  <p className="text-sm text-muted">
                    {identity(item.author)} · {date(item.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-primary">
                    {item.text}
                  </p>
                  <Link
                    href={moderatedDiscussionHref(id, undefined, undefined, item.id)}
                    className={linkAccentSm}
                  >
                    {copy.review}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title={emptyFiltered ? copy.emptyFiltered : copy.empty}
              description={emptyFiltered ? copy.emptyFilteredDescription : copy.emptyDescription}
              action={
                emptyFiltered ? (
                  <Link href={moderatedDiscussionHref(id)} className={linkAccentSm}>
                    {general.reset}
                  </Link>
                ) : undefined
              }
            />
          )}
        </>
      ) : (
        <>
          <section className={panelSpace4P5}>
            {data.comment ? (
              <>
                <h2 className="font-semibold text-primary">{copy.body}</h2>
                <p className="text-sm text-muted">
                  {identity(data.comment.author)} · {date(data.comment.createdAt)}
                </p>
                {data.comment.parent && (
                  <blockquote className="space-y-2 border-l-2 border-base pl-3 text-sm text-muted">
                    <p>{copy.parent}</p>
                    <p className="whitespace-pre-wrap break-words">{data.comment.parent}</p>
                  </blockquote>
                )}
                <p className="whitespace-pre-wrap break-words text-primary">{data.comment.text}</p>
                {data.comment.truncated && (
                  <p role="status" className="text-sm text-muted">
                    {copy.truncated}
                  </p>
                )}
                <ModeratedDiscussionRemoval
                  key={data.comment.revision}
                  contentId={id}
                  commentId={data.comment.id}
                  revision={data.comment.revision}
                  locale={locale}
                />
              </>
            ) : (
              <p role="status" className="text-sm text-muted">
                {copy.removed}
              </p>
            )}
          </section>
          <section className={panelSpace4P5}>
            <h2 className="font-semibold text-primary">{copy.history}</h2>
            <p className="text-xs text-muted">{copy.historyHelp}</p>
            {data.history.length ? (
              <ul className="space-y-3">
                {data.history.map((event) => (
                  <li
                    key={event.id}
                    className="space-y-2 rounded border border-base p-3 text-sm text-primary"
                  >
                    <p>
                      {event.action === "content.comment_edited" ? copy.edited : copy.deleted} ·{" "}
                      {event.moderator ? copy.moderator : copy.owner}
                    </p>
                    <p className="text-xs text-muted">{date(event.createdAt)}</p>
                    {event.reason && (
                      <p className="whitespace-pre-wrap break-words">{event.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={copy.emptyHistory} description={copy.emptyHistoryDescription} />
            )}
          </section>
        </>
      )}
      <nav aria-label={copy.title} className="flex flex-wrap gap-4">
        <Link
          prefetch={false}
          href={moderatedDiscussionHref(
            id,
            commentId
              ? undefined
              : (filters as NonNullable<ReturnType<typeof parseModeratedDiscussionQuery>>),
            undefined,
            commentId,
          )}
          className={linkAccentSm}
        >
          {general.latest}
        </Link>
        {data.nextCursor && (
          <Link
            prefetch={false}
            href={moderatedDiscussionHref(
              id,
              commentId
                ? undefined
                : (filters as NonNullable<ReturnType<typeof parseModeratedDiscussionQuery>>),
              data.nextCursor,
              commentId,
            )}
            className={linkAccentSm}
          >
            {general.older}
          </Link>
        )}
      </nav>
    </div>
  );
}
