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
import { PlatformSignIn } from "../../shell/guest-auth";
import {
  pageShellMax5xlBare,
  pageShellMax5xlTight as pageShellClass,
} from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { moderationCopy } from "../community-moderation-copy";
import { REPORT_TYPES } from "../community-report-contract";
import { communityReportCopy } from "../community-report-copy";
import { DiscussionReportBatch } from "../components/discussion-report-batch";
import {
  discussionReportsHref,
  discussionReportsPageSchema,
  parseDiscussionReportsQuery,
} from "../discussion-reports-contract";
import { discussionReportsCopy } from "../discussion-reports-copy";
import { moderatedDiscussionHref } from "../moderated-discussion-contract";
import { platformFieldClass } from "../user-platform-client";

const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function DiscussionReportsLoadError({ locale, retryHref }: { locale: Locale; retryHref: string }) {
  const copy = discussionReportsCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <section className={`nexus-panel space-y-3 p-5 ${pageShellClass}`}>
      <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={navLinkClass}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function discussionReportsMetadata(): Promise<Metadata> {
  return {
    title: discussionReportsCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export async function DiscussionReportsScreen({
  id,
  commentId,
  searchParams,
}: {
  id: string;
  commentId: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = discussionReportsCopy(locale),
    general = moderationCopy(locale),
    labels = communityReportCopy(locale);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const stablePath = `/admin/community/${encodeURIComponent(id)}/discussion/${encodeURIComponent(commentId)}/reports`;
  const path = `${stablePath}${params.size ? `?${params}` : ""}`;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={stablePath}
      />
    );
  }
  if (!actor) {
    return <PlatformSignIn locale={locale} returnPath={path} />;
  }
  if (!can(actor, "admin.moderation")) {
    const dictionary = getDictionary(locale);
    return (
      <div className={pageShellMax5xlBare}>
        <ErrorState
          title={general.denied}
          description={general.deniedHint}
          action={
            <Link href="/admin" className={navLinkClass}>
              {dictionary.admin.title}
            </Link>
          }
        />
      </div>
    );
  }
  const filters = parseDiscussionReportsQuery(params);
  let failure = "";
  if (!filters) failure = general.invalid;
  let loadFailed = false;
  const raw = filters
    ? await communityModerationService
        .discussionReports(actor, id, commentId, filters)
        .catch((error: unknown) => {
          if (error instanceof AppError && error.statusCode === 404) notFound();
          if (
            error instanceof AppError &&
            (error.statusCode === 403 || error.code === "FORBIDDEN")
          ) {
            failure = general.denied;
            return null;
          }
          loadFailed = true;
          return null;
        })
    : null;
  const parsed = discussionReportsPageSchema.safeParse(raw);
  if (!parsed.success || parsed.data.publication.id !== id || parsed.data.commentId !== commentId) {
    if (loadFailed) {
      return <DiscussionReportsLoadError locale={locale} retryHref={path} />;
    }
    return (
      <div className={pageShellMax5xlBare}>
        <ErrorState
          title={failure || copy.unavailable}
          description={copy.loadUnavailableHint}
          action={
            <a href={path} className={navLinkClass}>
              {general.reload}
            </a>
          }
        />
      </div>
    );
  }
  const data = parsed.data;
  const emptyFiltered = Boolean(
    filters && (filters.query || filters.type || filters.view === "history" || filters.cursor),
  );
  return (
    <div className={pageShellClass}>
      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="break-words text-primary">
          {data.publication.title} · {general[data.publication.status]}
        </p>
        <Link
          href={moderatedDiscussionHref(id, undefined, undefined, commentId)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.back}
        </Link>
      </header>
      {data.removed && (
        <p role="status" className="nexus-panel p-4 text-sm text-muted">
          {copy.removed}
        </p>
      )}
      <search aria-label={copy.search}>
        <form action={path} className="nexus-panel grid gap-4 p-5 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-primary">
            <span>{copy.search}</span>
            <input
              className={platformFieldClass}
              name="q"
              type="search"
              maxLength={100}
              defaultValue={filters?.query}
            />
          </label>
          <label className="space-y-1 text-sm text-primary">
            <span>{copy.view}</span>
            <select className={platformFieldClass} name="view" defaultValue={filters?.view}>
              <option value="pending">{copy.pending}</option>
              <option value="history">{copy.history}</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-primary">
            <span>{copy.type}</span>
            <select className={platformFieldClass} name="type" defaultValue={filters?.type ?? ""}>
              <option value="">{copy.all}</option>
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {labels[type]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-3 self-end">
            <Button className="min-h-11" type="submit">
              {copy.apply}
            </Button>
            <Link
              href={path}
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.clear}
            </Link>
          </div>
        </form>
      </search>
      {data.items.length === 0 ? (
        <EmptyState
          title={emptyFiltered ? copy.emptyFiltered : copy.empty}
          description={emptyFiltered ? copy.emptyFilteredDescription : copy.emptyDescription}
          action={
            emptyFiltered ? (
              <Link href={discussionReportsHref(id, commentId)} className={navLinkClass}>
                {copy.clear}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <DiscussionReportBatch
          key={`${id}:${commentId}:${filters?.query}:${filters?.view}:${filters?.type}:${filters?.cursor?.id}:${data.removed}:${data.items.map((item) => `${item.id}:${item.status}:${item.createdAt}`).join("|")}`}
          contentId={id}
          commentId={commentId}
          items={data.items}
          locale={locale}
          allowActions={filters?.view === "pending"}
        />
      )}
      <nav className="flex flex-wrap gap-4" aria-label={copy.title}>
        <Link
          prefetch={false}
          href={discussionReportsHref(id, commentId, filters ?? undefined)}
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {general.latest}
        </Link>
        {data.nextCursor && (
          <Link
            prefetch={false}
            href={discussionReportsHref(id, commentId, filters ?? undefined, data.nextCursor)}
            className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {general.older}
          </Link>
        )}
      </nav>
    </div>
  );
}
