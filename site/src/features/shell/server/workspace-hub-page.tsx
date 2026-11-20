import { serverRepository } from "@nexus/db";
import { EmptyState, ErrorState, SectionHeader, StatCard } from "@nexus/ui";
import { Box, Plus, Server as ServerIcon, Users } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { formatUnknown } from "../../../lib/i18n/unknown";
import { authService } from "../../../lib/services/accounts/auth-service";
import { userLibraryService } from "../../../lib/services/library/user-library-service";
import {
  indexMtaObservations,
  mtaLiveStatus,
  mtaMasterDirectoryService,
} from "../../../lib/services/servers/mta-master-directory-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { getCommerceHistoryCopy } from "../../commerce/commerce-history-i18n";
import { reactionCopy } from "../../community/content-reaction-copy";
import { ownDiscussionCopy } from "../../community/discussion-workspace-copy";
import { getLibraryCopy } from "../../library/library-view";
import { ManagedServerCard } from "../../servers/managed-card-server";
import { getManagedServerCopy } from "../../servers/managed-server-view";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { PlatformSignIn, platformSignInFocusClass } from "../guest-auth";
import { pageShellStack8 } from "../page-shell";
import { PlatformSessionError } from "../session-error";
import {
  typeDisplayPrimary,
  typeFlexMinWrapGap2,
  typeFlexWrapCenterGap3,
  typeFlexWrapGap2,
  typeIcon35,
  typeMinSpace3,
  typeMinSpace4,
  typeMt05CaptionMuted,
  typeXsFaint,
} from "../type-shell";
export async function workspaceHubMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).workspace.title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

const primaryCtaClass = `inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-4 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] ${platformSignInFocusClass}`;
const secondaryCtaClass = `inline-flex min-h-11 items-center gap-1.5 rounded-md border border-base bg-surface px-4 text-xs font-semibold text-secondary transition-colors hover:border-strong hover:bg-hover hover:text-primary ${platformSignInFocusClass}`;
const navChipClass = `inline-flex min-h-11 items-center rounded-md border border-base px-4 text-xs font-semibold text-secondary hover:text-primary ${platformSignInFocusClass}`;
const historyNavClass =
  "inline-flex min-h-11 items-center rounded-md border border-base bg-surface px-4 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary";
const sectionLinkClass =
  "inline-flex min-h-11 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function WorkspaceHubPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const historyCopy = getCommerceHistoryCopy(locale);
  const libraryCopy = getLibraryCopy(locale);
  const serverCopy = getManagedServerCopy(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={dictionary.workspace.title}
        message={dictionary.workspace.libraryUnavailable}
        retryHref="/workspace"
      />
    );
  }

  if (!user) return <PlatformSignIn locale={locale} returnPath="/workspace" />;

  const [library, serverBundle] = await Promise.all([
    userLibraryService.pageByUser(user.id, 1, "all", 4).catch(() => null),
    serverRepository
      .pageManagedByUser(user.id, 1, {}, 4)
      .then(async (serverPage) => ({
        serverPage,
        directory:
          serverPage.servers.length > 0
            ? await mtaMasterDirectoryService.getDirectory().catch(() => null)
            : null,
      }))
      .catch(() => null),
  ]);
  const managedServers = serverBundle?.serverPage.servers ?? [];
  const downloadable = library?.items ?? [];
  const observationFor = indexMtaObservations(serverBundle?.directory?.servers ?? []);
  const directoryIsFresh = Boolean(serverBundle?.directory && !serverBundle.directory.isStale);
  const liveByServerId = new Map(
    managedServers.map((server) => [server.id, observationFor(server) ?? null]),
  );
  const onlineServers = managedServers.filter((server) => {
    const observation = liveByServerId.get(server.id);
    return mtaLiveStatus(observation, !directoryIsFresh) === "online";
  });
  const onlinePlayers = onlineServers.reduce(
    (total, server) => total + (liveByServerId.get(server.id)?.players ?? 0),
    0,
  );
  const playerCountsKnown =
    Boolean(serverBundle) &&
    directoryIsFresh &&
    managedServers.every((server) => {
      const observation = liveByServerId.get(server.id);
      return mtaLiveStatus(observation, false) === "offline" || observation?.players != null;
    });
  return (
    <div className={pageShellStack8}>
      <header className="flex min-w-0 flex-col justify-between gap-4 border-b border-base pb-6 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className={typeDisplayPrimary}>{dictionary.workspace.title}</h1>
          <p className={typeMt05CaptionMuted}>
            @{user.username} · {dictionary.workspace.subtitle}
          </p>
          <p className="mt-1 max-w-2xl font-caption text-faint">{dictionary.workspace.liveNote}</p>
        </div>

        {/* UX-23 interim: group by library / servers / publications — history stays below. */}
        <div className="flex min-w-0 flex-col gap-3">
          <nav className={typeFlexWrapGap2} aria-label={dictionary.workspace.libraryTitle}>
            <Link href="/workspace/library" className={navChipClass}>
              {dictionary.workspace.libraryTitle}
            </Link>
            <Link href="/workspace/resources" className={navChipClass}>
              {dictionary.authorResources.title}
            </Link>
            <Link href="/workspace/resources/new" className={primaryCtaClass}>
              <Plus className={typeIcon35} aria-hidden="true" />
              {dictionary.workspace.publishResource}
            </Link>
          </nav>
          <nav className={typeFlexWrapGap2} aria-label={serverCopy.title}>
            <Link href="/workspace/servers/new" className={secondaryCtaClass}>
              <Plus className={typeIcon35} aria-hidden="true" />
              {dictionary.workspace.registerServer}
            </Link>
          </nav>
          <nav className={typeFlexWrapGap2} aria-label={ownDiscussionCopy(locale).title}>
            <Link href="/workspace/discussions" className={navChipClass}>
              {ownDiscussionCopy(locale).title}
            </Link>
            <Link href="/workspace/reactions" className={navChipClass}>
              {reactionCopy(locale).my}
            </Link>
          </nav>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={dictionary.workspace.resources}
          value={formatUnknown(locale, library ? library.counts.all : undefined)}
          tone="purple"
          icon={<Box className="h-4 w-4" />}
          context={dictionary.workspace.inLibrary}
        />
        <StatCard
          label={serverCopy.title}
          value={formatUnknown(locale, serverBundle ? serverBundle.serverPage.total : undefined)}
          tone="accent"
          icon={<ServerIcon className="h-4 w-4" />}
          context={
            !serverBundle
              ? dictionary.workspace.liveUnavailable
              : directoryIsFresh
                ? `${onlineServers.length} ${serverCopy.previewOnline}`
                : dictionary.workspace.liveUnavailable
          }
        />
        <StatCard
          label={dictionary.workspace.playersOnline}
          value={formatUnknown(locale, playerCountsKnown ? onlinePlayers : undefined)}
          tone="success"
          icon={<Users className="h-4 w-4" />}
          context={serverCopy.previewPlayers}
        />
      </div>

      <nav aria-label={historyCopy.navigation} className={typeFlexMinWrapGap2}>
        {(["purchases", "licenses", "sales"] as const).map((area) => (
          <Link key={area} href={`/workspace/${area}`} className={historyNavClass}>
            {historyCopy.tabs[area]}
          </Link>
        ))}
      </nav>

      <section className={typeMinSpace4}>
        <SectionHeader
          title={dictionary.workspace.libraryTitle}
          description={libraryCopy.subtitle}
          action={
            <div className={typeFlexWrapCenterGap3}>
              <Link href="/workspace/library" className={sectionLinkClass}>
                {libraryCopy.title}
              </Link>
              <Link href="/market?maxPrice=0" className={sectionLinkClass}>
                {dictionary.workspace.browseResources}
              </Link>
            </div>
          }
        />

        {!library ? (
          <ErrorState
            title={dictionary.workspace.libraryUnavailable}
            description={dictionary.workspace.libraryUnavailableHint}
            action={
              <Link href="/workspace" className={linkAccentSmRounded}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        ) : library.counts.all > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {downloadable.map((entitlement) => {
              return (
                <article
                  key={entitlement.resourceId}
                  className="nexus-panel flex min-w-0 items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-primary">
                      {entitlement.downloadable
                        ? entitlement.title
                        : libraryCopy.unavailableResource}
                    </div>
                    <div className={typeXsFaint}>
                      {dictionary.workspace.added}{" "}
                      <time dateTime={new Date(entitlement.addedAt).toISOString()}>
                        {formatHistoryDate(new Date(entitlement.addedAt), locale)}
                      </time>
                    </div>
                  </div>
                  {entitlement.downloadable && entitlement.slug && (
                    <Link
                      href={`/market/${entitlement.slug}`}
                      className="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                    >
                      {dictionary.workspace.open}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={dictionary.workspace.emptyLibrary}
            description={dictionary.workspace.emptyLibraryHint}
            action={
              <Link href="/market?maxPrice=0" className={linkAccentSmRounded}>
                {dictionary.workspace.browseResources}
              </Link>
            }
          />
        )}
      </section>

      <section className={typeMinSpace4}>
        <SectionHeader
          title={serverCopy.title}
          description={serverCopy.preview}
          action={
            <div className={typeFlexWrapCenterGap3}>
              <Link href="/workspace/servers" className={sectionLinkClass}>
                {serverCopy.openAll}
              </Link>
              <Link href="/workspace/servers/new" className={sectionLinkClass}>
                {dictionary.workspace.registerServer}
              </Link>
            </div>
          }
        />

        {!serverBundle ? (
          <ErrorState
            title={dictionary.workspace.serversUnavailable}
            description={dictionary.workspace.serversUnavailableHint}
            action={
              <Link href="/workspace" className={linkAccentSmRounded}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        ) : managedServers.length > 0 ? (
          <div className={typeMinSpace3}>
            {managedServers.map((server) => {
              const observation = liveByServerId.get(server.id);
              return (
                <ManagedServerCard
                  key={server.id}
                  server={server}
                  observation={observation}
                  isStale={!directoryIsFresh}
                  locale={locale}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={dictionary.workspace.noServers}
            description={dictionary.workspace.noServersHint}
            action={
              <Link href="/workspace/servers/new" className={linkAccentSmRounded}>
                {dictionary.workspace.registerServer}
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
