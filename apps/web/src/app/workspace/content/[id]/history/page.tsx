import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { AuthorPublicationRestore } from "../../../../../components/author-publication-restore";
import { parseAuthorPublicationHistoryQuery } from "../../../../../lib/author-publication-desk-contract";
import {
  authorPublicationDeskCopy,
  authorPublicationDeskError,
} from "../../../../../lib/author-publication-desk-copy";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
import { authorContentService } from "../../../../../lib/services/author-content-service";
import { getUserPlatformCopy } from "../../../../../lib/user-platform-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = authorPublicationDeskCopy(await getRequestLocale());
  return {
    title: copy.history,
    description: copy.historyDescription,
    robots: { index: false, follow: false },
  };
}
export default async function PublicationHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = authorPublicationDeskCopy(locale),
    labels = getUserPlatformCopy(locale),
    { id } = await params,
    path = `/workspace/content/${encodeURIComponent(id)}/history`,
    query = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const part of Array.isArray(value) ? value : [value]) query.append(key, part);
  const filters = parseAuthorPublicationHistoryQuery(query);
  let error = filters ? "" : copy.invalid,
    signIn = false;
  const report = await (async () => {
    try {
      const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
      if (!actor) {
        signIn = true;
        return null;
      }
      return filters ? await authorContentService.history(id, actor, filters) : null;
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
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/workspace/content"
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {labels.back}
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-primary">{copy.history}</h1>
        <p className="text-sm text-muted">{copy.historyDescription}</p>
        {report && (
          <h2 className="break-words text-lg font-semibold text-primary">{report.item.title}</h2>
        )}
      </header>
      {signIn && (
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {labels.signIn}
        </Link>
      )}
      {error && (
        <p role="alert" className="nexus-panel p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {report && (
        <>
          <p className="text-sm text-muted">
            {labels.status}: {state(report.item.status)}
          </p>
          <Link
            prefetch={false}
            href={`/workspace/content/${encodeURIComponent(id)}`}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
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
            <div className="nexus-panel space-y-2 p-4">
              <p className="text-sm text-muted">{copy.restoreHelp}</p>
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
              >
                {copy.support}
              </Link>
            </div>
          )}
          <Link
            prefetch={false}
            href={path}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.historyLatest}
          </Link>
          {!report.events.length && (
            <p className="nexus-panel p-6 text-sm text-muted">{copy.historyEmpty}</p>
          )}
          <ol className="space-y-3">
            {report.events.map((event) => (
              <li key={event.id} className="nexus-panel space-y-2 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <span className="text-sm font-semibold text-primary">{action(event.kind)}</span>
                  <time dateTime={event.createdAt} className="text-xs text-muted">
                    {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <p className="text-xs text-muted">
                  {event.actor === "moderation"
                    ? copy.actorModeration
                    : event.actor === "team"
                      ? copy.actorTeam
                      : copy.actorAuthor}
                </p>
                {(event.from || event.to) && (
                  <p className="text-sm text-secondary">
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
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.historyOlder}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
