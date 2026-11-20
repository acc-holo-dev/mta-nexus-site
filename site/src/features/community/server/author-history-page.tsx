import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { authorContentService } from "../../../lib/services/organizations/author-content-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xlTight as pageShellClass } from "../../shell/page-shell";
import { panelMinSpace2P4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  type2xlExtraboldPrimary,
  typeFlexWrapBetweenGap3,
  typeMinSpace2,
  typeMinSpace3,
  typeSmMuted,
  typeSmSecondary,
  typeSmSemiboldPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { publicationSupportHref } from "../../support/support-workspace-contract";
import { parseAuthorPublicationHistoryQuery } from "../author-publication-desk-contract";
import {
  authorPublicationDeskCopy,
  authorPublicationDeskError,
} from "../author-publication-desk-copy";
import { AuthorPublicationRestore } from "../author-publication-restore";
import { getUserPlatformCopy } from "../user-platform-copy";
export async function publicationHistoryMetadata(): Promise<Metadata> {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return {
    title: copy.history,
    description: copy.historyDescription,
    robots: { index: false, follow: false },
  };
}

export async function PublicationHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = authorPublicationDeskCopy(locale),
    dictionary = getDictionary(locale),
    labels = getUserPlatformCopy(locale),
    { id } = await params,
    path = `/workspace/content/${encodeURIComponent(id)}/history`,
    query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const part of Array.isArray(value) ? value : [value]) query.append(key, part);
  const returnQuery = query.toString();
  const returnPath = returnQuery ? `${path}?${returnQuery}` : path;
  let sessionActor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    sessionActor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.history}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!sessionActor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const filters = parseAuthorPublicationHistoryQuery(query);
  let error = filters ? "" : copy.invalid;
  const report = await (async () => {
    try {
      return filters ? await authorContentService.history(id, sessionActor, filters) : null;
    } catch (failure) {
      error =
        failure instanceof AppError
          ? authorPublicationDeskError(locale, failure.code)
          : copy.unavailable;
      return null;
    }
  })();
  const action = (value: string) =>
    value === "created"
      ? copy.created
      : value === "edited"
        ? copy.edited
        : value === "published"
          ? copy.published
          : value === "restored"
            ? copy.restored
            : copy.archived;
  const state = (value: string | null) =>
    value === "draft"
      ? labels.draft
      : value === "published"
        ? labels.published
        : value === "archived"
          ? labels.archived
          : null;
  const retryHref = filters ? returnPath : path;
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/content" className={linkAccentSm}>
        {labels.back}
      </Link>
      <header className={typeMinSpace2}>
        <h1 className={type2xlExtraboldPrimary}>{copy.history}</h1>
        <p className={typeSmMuted}>{copy.historyDescription}</p>
        {report && (
          <h2 className="break-words text-lg font-semibold text-primary">{report.item.title}</h2>
        )}
      </header>
      {error && (
        <ErrorState
          title={error}
          description={copy.unavailableHint}
          action={
            <Link href={retryHref} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      )}
      {report && (
        <>
          <p className={typeSmMuted}>
            {labels.status}: {state(report.item.status)}
          </p>
          <Link
            prefetch={false}
            href={`/workspace/content/${encodeURIComponent(id)}`}
            className={linkAccentSm}
          >
            {labels.edit}
          </Link>
          {report.item.recoverable && (
            <AuthorPublicationRestore
              key={report.item.revision}
              id={id}
              revision={report.item.revision}
              locale={locale}
            />
          )}
          {report.item.status === "archived" && !report.item.recoverable && (
            <div className={panelMinSpace2P4}>
              <p className={typeSmMuted}>{copy.restoreHelp}</p>
              <Link href={publicationSupportHref(report.item.title)} className={linkAccentSm}>
                {copy.support}
              </Link>
            </div>
          )}
          <Link prefetch={false} href={path} className={linkAccentSm}>
            {copy.historyLatest}
          </Link>
          {!report.events.length && (
            <EmptyState title={copy.historyEmpty} description={copy.historyEmptyHint} />
          )}
          <ol className={typeMinSpace3}>
            {report.events.map((event) => (
              <li key={event.id} className={panelMinSpace2P4}>
                <div className={typeFlexWrapBetweenGap3}>
                  <span className={typeSmSemiboldPrimary}>{action(event.kind)}</span>
                  <time dateTime={event.createdAt} className={typeXsMuted}>
                    {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className={typeXsMuted}>
                  {event.actor === "moderation"
                    ? copy.actorModeration
                    : event.actor === "team"
                      ? copy.actorTeam
                      : copy.actorAuthor}
                </p>
                {(event.from || event.to) && (
                  <p className={typeSmSecondary}>
                    {state(event.from)}
                    {event.from && event.to ? " → " : ""}
                    {state(event.to)}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {report.olderCursor && (
            <Link
              prefetch={false}
              href={`${path}?${new URLSearchParams({ cursor: report.olderCursor })}`}
              className={linkAccentSm}
            >
              {copy.historyOlder}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
