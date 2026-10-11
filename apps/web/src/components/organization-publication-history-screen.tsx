import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { parseAuthorPublicationHistoryQuery } from "../lib/author-publication-desk-contract";
import { authorPublicationDeskCopy } from "../lib/author-publication-desk-copy";
import { getRequestLocale } from "../lib/i18n-server";
import { organizationContentCopy } from "../lib/organization-content-copy";
import { organizationPublicationHistorySchema } from "../lib/organization-publication-history-contract";
import {
  organizationPublicationHistoryCopy,
  organizationPublicationHistoryError,
} from "../lib/organization-publication-history-copy";
import { authService } from "../lib/services/auth-service";
import { organizationContentService } from "../lib/services/organization-content-service";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
import { AuthorPublicationRestore } from "./author-publication-restore";
export async function OrganizationPublicationHistoryScreen({
  id,
  contentId,
  searchParams,
}: {
  id: string;
  contentId: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = organizationPublicationHistoryCopy(locale),
    history = authorPublicationDeskCopy(locale),
    labels = getUserPlatformCopy(locale),
    path = `/workspace/organizations/${encodeURIComponent(id)}/content/${encodeURIComponent(contentId)}/history`;
  let failure = "";
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      failure = copy.unavailable;
      return null;
    });
  if (!actor)
    return (
      <section className="nexus-panel space-y-3 p-5">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        {failure ? (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        ) : (
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center text-accent underline"
          >
            {labels.signIn}
          </Link>
        )}
      </section>
    );
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const filters = parseAuthorPublicationHistoryQuery(params);
  if (!filters) failure = history.invalid;
  const raw = filters
    ? await organizationContentService
        .history(id, actor, contentId, filters)
        .catch((error: unknown) => {
          failure = organizationPublicationHistoryError(
            locale,
            error instanceof AppError ? error.code : "INTERNAL_ERROR",
          );
          return null;
        })
    : null;
  const result = organizationPublicationHistorySchema.safeParse(raw);
  const data =
    result.success && result.data.organization.id === id && result.data.item.id === contentId
      ? result.data
      : null;
  const base = `/workspace/organizations/${encodeURIComponent(id)}/content`;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href={base} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {organizationContentCopy(locale).title}
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        {data && (
          <p className="break-words font-semibold text-primary">
            {data.organization.name} · {data.item.title}
          </p>
        )}
      </header>
      {!data ? (
        <section className="nexus-panel space-y-3 p-5">
          <p role="alert" className="text-sm text-danger">
            {failure || copy.unavailable}
          </p>
          <a
            href={path}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {history.reload}
          </a>
        </section>
      ) : (
        <>
          <p className="text-sm text-muted">
            {labels.status}: {labels[data.item.status]}
          </p>
          <Link
            href={`${base}/${encodeURIComponent(contentId)}`}
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {labels.edit}
          </Link>
          {data.item.recoverable && (
            <AuthorPublicationRestore
              key={data.item.revision}
              id={contentId}
              revision={data.item.revision}
              locale={locale}
              organizationId={id}
            />
          )}
          {data.item.status === "archived" && !data.item.recoverable && (
            <section className="nexus-panel space-y-2 p-4">
              <p className="text-sm text-muted">{copy.restoreHelp}</p>
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
              >
                {history.support}
              </Link>
            </section>
          )}
          {!data.events.length ? (
            <p className="nexus-panel p-5 text-muted">{history.historyEmpty}</p>
          ) : (
            <ol className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className="nexus-panel space-y-2 p-4">
                  <p className="font-semibold text-primary">{history[event.kind]}</p>
                  <time dateTime={event.createdAt} className="text-xs text-muted">
                    {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                      timeZone: "UTC",
                      timeZoneName: "short",
                    })}
                  </time>
                  <p className="text-xs text-muted">
                    {event.actor === "moderation"
                      ? history.actorModeration
                      : event.actor === "team"
                        ? history.actorTeam
                        : history.actorAuthor}
                  </p>
                  {event.identity && (
                    <Link
                      href={`/users/${encodeURIComponent(event.identity.username)}`}
                      className="inline-flex min-h-11 items-center text-sm text-accent"
                    >
                      {copy.identity}: {event.identity.name} (@{event.identity.username})
                    </Link>
                  )}
                  {(event.from || event.to) && (
                    <p className="text-sm text-primary">
                      {event.from ? labels[event.from] : ""}
                      {event.from && event.to ? " → " : ""}
                      {event.to ? labels[event.to] : ""}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <nav aria-label={copy.title} className="flex flex-wrap gap-4">
            <Link
              prefetch={false}
              href={path}
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {history.historyLatest}
            </Link>
            {data.olderCursor && (
              <Link
                prefetch={false}
                href={`${path}?${new URLSearchParams({ cursor: data.olderCursor })}`}
                className="inline-flex min-h-11 items-center text-sm text-accent underline"
              >
                {history.historyOlder}
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
