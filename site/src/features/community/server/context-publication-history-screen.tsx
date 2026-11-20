import type { User } from "@nexus/domain";
import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { organizationContentCopy } from "../../organizations/organization-content-copy";
import {
  organizationPublicationHistoryCopy,
  organizationPublicationHistoryError,
} from "../../organizations/organization-publication-history-copy";
import { serverContentCopy } from "../../servers/server-content-copy";
import {
  serverPublicationHistoryCopy,
  serverPublicationHistoryError,
} from "../../servers/server-publication-history-copy";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace2P4, panelSpace2P4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  type2xlBoldPrimary,
  typeBreakSemiboldPrimary,
  typeFlexWrapGap4,
  typeSemiboldPrimary,
  typeSmMuted,
  typeSmPrimary,
  typeXsMuted,
} from "../../shell/type-shell";
import { publicationSupportHref } from "../../support/support-workspace-contract";
import { parseAuthorPublicationHistoryQuery } from "../author-publication-desk-contract";
import { authorPublicationDeskCopy } from "../author-publication-desk-copy";
import { AuthorPublicationRestore } from "../author-publication-restore";
import { organizationPublicationHistorySchema } from "../organization-publication-history-contract";
import { serverPublicationHistorySchema } from "../server-publication-history-contract";
import { getUserPlatformCopy } from "../user-platform-copy";
export async function ContextPublicationHistoryScreen({
  id,
  contentId,
  searchParams,
  kind,
  load,
}: {
  kind: "organizations" | "servers";
  load: (
    actor: User,
    filters: NonNullable<ReturnType<typeof parseAuthorPublicationHistoryQuery>>,
  ) => Promise<unknown>;
  id: string;
  contentId: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy =
      kind === "servers"
        ? serverPublicationHistoryCopy(locale)
        : organizationPublicationHistoryCopy(locale),
    translateError =
      kind === "servers" ? serverPublicationHistoryError : organizationPublicationHistoryError,
    workspaceTitle =
      kind === "servers" ? serverContentCopy(locale).title : organizationContentCopy(locale).title,
    history = authorPublicationDeskCopy(locale),
    labels = getUserPlatformCopy(locale),
    path = `/workspace/${kind}/${encodeURIComponent(id)}/content/${encodeURIComponent(contentId)}/history`;
  let failure = "";
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.unavailable}
        retryHref={path}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={path} />;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const filters = parseAuthorPublicationHistoryQuery(params);
  if (!filters) failure = history.invalid;
  const raw = filters
    ? await load(actor, filters).catch((error: unknown) => {
        failure = translateError(locale, error instanceof AppError ? error.code : "INTERNAL_ERROR");
        return null;
      })
    : null;
  const result = (
    kind === "servers" ? serverPublicationHistorySchema : organizationPublicationHistorySchema
  ).safeParse(raw);
  const context = result.success
    ? "server" in result.data
      ? result.data.server
      : result.data.organization
    : null;
  const data =
    result.success && context?.id === id && result.data.item.id === contentId ? result.data : null;
  const base = `/workspace/${kind}/${encodeURIComponent(id)}/content`;
  const emptyDescription = copy.historyEmptyHint;
  return (
    <div className={pageShellClass}>
      <Link href={base} className={linkAccentSmRounded}>
        {workspaceTitle}
      </Link>
      <header className="space-y-2">
        <h1 className={type2xlBoldPrimary}>{copy.title}</h1>
        <p className={typeSmMuted}>{copy.description}</p>
        {data && (
          <p className={typeBreakSemiboldPrimary}>
            {context?.name} · {data.item.title}
          </p>
        )}
      </header>
      {!data ? (
        <ErrorState
          title={failure || copy.unavailable}
          description={copy.unavailableHint}
          action={
            <a href={path} className={linkAccentSmRounded}>
              {history.reload}
            </a>
          }
        />
      ) : (
        <>
          <p className={typeSmMuted}>
            {labels.status}: {labels[data.item.status]}
          </p>
          <Link href={`${base}/${encodeURIComponent(contentId)}`} className={linkAccentSmRounded}>
            {labels.edit}
          </Link>
          {data.item.recoverable && (
            <AuthorPublicationRestore
              key={data.item.revision}
              id={contentId}
              revision={data.item.revision}
              locale={locale}
              {...(kind === "servers" ? { serverId: id } : { organizationId: id })}
            />
          )}
          {data.item.status === "archived" && !data.item.recoverable && (
            <section className={panelSpace2P4}>
              <p className={typeSmMuted}>{copy.restoreHelp}</p>
              <Link href={publicationSupportHref(data.item.title)} className={linkAccentSmRounded}>
                {history.support}
              </Link>
            </section>
          )}
          {!data.events.length ? (
            <EmptyState title={history.historyEmpty} description={emptyDescription} />
          ) : (
            <ol className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className={panelClipSpace2P4}>
                  <p className={typeSemiboldPrimary}>{history[event.kind]}</p>
                  <time dateTime={event.createdAt} className={typeXsMuted}>
                    {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                      timeZone: "UTC",
                      timeZoneName: "short",
                    })}
                  </time>
                  <p className={typeXsMuted}>
                    {event.actor === "moderation"
                      ? history.actorModeration
                      : event.actor === "team"
                        ? history.actorTeam
                        : history.actorAuthor}
                  </p>
                  {event.identity && (
                    <Link
                      href={`/users/${encodeURIComponent(event.identity.username)}`}
                      className={linkAccentSmRounded}
                    >
                      {copy.identity}: {event.identity.name} (@{event.identity.username})
                    </Link>
                  )}
                  {(event.from || event.to) && (
                    <p className={typeSmPrimary}>
                      {event.from ? labels[event.from] : ""}
                      {event.from && event.to ? " → " : ""}
                      {event.to ? labels[event.to] : ""}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
          <nav aria-label={copy.title} className={typeFlexWrapGap4}>
            <Link prefetch={false} href={path} className={linkAccentSmRounded}>
              {history.historyLatest}
            </Link>
            {data.olderCursor && (
              <Link
                prefetch={false}
                href={`${path}?${new URLSearchParams({ cursor: data.olderCursor })}`}
                className={linkAccentSmRounded}
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
