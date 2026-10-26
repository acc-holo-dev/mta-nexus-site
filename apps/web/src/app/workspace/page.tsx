import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { serverRepository, userLibraryRepository } from "@nexus/db";
import { Box, Plus, Server as ServerIcon, Users } from "lucide-react";
import { SectionHeader, StatCard } from "@nexus/ui";
import { authService } from "../../lib/services/auth-service";
import {
  indexMtaObservations,
  mtaLiveStatus,
  mtaMasterDirectoryService,
} from "../../lib/services/mta-master-directory-service";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { getCommerceHistoryCopy } from "../../lib/commerce-history-i18n";
import { getLibraryCopy } from "../../lib/library-view";
import { getManagedServerCopy } from "../../lib/managed-server-view";
import { formatHistoryDate } from "../../lib/commerce-history-format";
import { ManagedServerCard } from "../../components/managed-server-card";
import { reactionCopy } from "../../lib/content-reaction-copy";
import { ownDiscussionCopy } from "../../lib/discussion-workspace-copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Workspace | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function WorkspacePage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const historyCopy = getCommerceHistoryCopy(locale);
  const libraryCopy = getLibraryCopy(locale);
  const serverCopy = getManagedServerCopy(locale);
  const token = (await cookies()).get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <p className="font-caption text-muted">{dictionary.workspace.signInMessage}</p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {dictionary.workspace.signIn}
        </Link>
      </div>
    );
  }

  const [library, { serverPage, directory }] = await Promise.all([
    userLibraryRepository.pageByUser(user.id, 1, "all", 4),
    serverRepository.pageManagedByUser(user.id, 1, {}, 4).then(async (serverPage) => ({
      serverPage,
      directory:
        serverPage.servers.length > 0
          ? await mtaMasterDirectoryService.getDirectory().catch(() => null)
          : null,
    })),
  ]);
  const managedServers = serverPage.servers;
  const downloadable = library.items;
  const observationFor = indexMtaObservations(directory?.servers ?? []);
  const directoryIsFresh = Boolean(directory && !directory.isStale);
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
    directoryIsFresh &&
    managedServers.every((server) => {
      const observation = liveByServerId.get(server.id);
      return mtaLiveStatus(observation, false) === "offline" || observation?.players != null;
    });
  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 border-b border-base pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-primary">{dictionary.workspace.title}</h1>
          <p className="mt-0.5 font-caption text-muted">
            @{user.username} · {dictionary.workspace.subtitle}
          </p>
          <p className="mt-1 max-w-2xl font-caption text-faint">{dictionary.workspace.liveNote}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/workspace/discussions"
            className="inline-flex min-h-11 items-center rounded-md border border-base px-4 text-xs font-semibold text-secondary hover:text-primary"
          >
            {ownDiscussionCopy(locale).title}
          </Link>
          <Link
            href="/workspace/reactions"
            className="inline-flex min-h-11 items-center rounded-md border border-base px-4 text-xs font-semibold text-secondary hover:text-primary"
          >
            {reactionCopy(locale).my}
          </Link>
          <Link
            href="/workspace/resources"
            className="rounded-md border border-base px-4 py-2 text-xs font-semibold text-secondary hover:text-primary"
          >
            {dictionary.authorResources.title}
          </Link>
          <Link
            href="/workspace/resources/new"
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {dictionary.workspace.publishResource}
          </Link>
          <Link
            href="/workspace/servers/new"
            className="flex items-center gap-1.5 rounded-md border border-base bg-surface px-4 py-2 text-xs font-semibold text-secondary transition-colors hover:border-strong hover:bg-hover hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {dictionary.workspace.registerServer}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={dictionary.workspace.resources}
          value={library.counts.all}
          tone="purple"
          icon={<Box className="h-4 w-4" />}
          context={dictionary.workspace.inLibrary}
        />
        <StatCard
          label={serverCopy.title}
          value={serverPage.total}
          tone="accent"
          icon={<ServerIcon className="h-4 w-4" />}
          context={
            directoryIsFresh
              ? `${onlineServers.length} ${serverCopy.previewOnline}`
              : dictionary.workspace.liveUnavailable
          }
        />
        <StatCard
          label={dictionary.workspace.playersOnline}
          value={playerCountsKnown ? onlinePlayers : "—"}
          tone="success"
          icon={<Users className="h-4 w-4" />}
          context={serverCopy.previewPlayers}
        />
      </div>

      <nav aria-label={historyCopy.navigation} className="flex flex-wrap gap-2">
        {(["purchases", "licenses", "sales"] as const).map((area) => (
          <Link
            key={area}
            href={`/workspace/${area}`}
            className="rounded-md border border-base bg-surface px-4 py-2 text-sm text-secondary transition-colors hover:bg-hover hover:text-primary"
          >
            {historyCopy.tabs[area]}
          </Link>
        ))}
      </nav>

      <section>
        <SectionHeader
          title={dictionary.workspace.libraryTitle}
          description={libraryCopy.subtitle}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/workspace/library"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {libraryCopy.title}
              </Link>
              <Link
                href="/market?maxPrice=0"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {dictionary.workspace.browseResources}
              </Link>
            </div>
          }
        />

        {library.counts.all > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {downloadable.map((entitlement) => {
              return (
                <article
                  key={entitlement.resourceId}
                  className="nexus-panel flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-primary">
                      {entitlement.downloadable
                        ? entitlement.title
                        : libraryCopy.unavailableResource}
                    </div>
                    <div className="text-xs text-faint">
                      {dictionary.workspace.added}{" "}
                      <time dateTime={new Date(entitlement.addedAt).toISOString()}>
                        {formatHistoryDate(new Date(entitlement.addedAt), locale)}
                      </time>
                    </div>
                  </div>
                  {entitlement.downloadable && entitlement.slug && (
                    <Link
                      href={`/market/${entitlement.slug}`}
                      className="shrink-0 text-xs font-semibold text-accent hover:underline"
                    >
                      {dictionary.workspace.open}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-muted">
            {dictionary.workspace.emptyLibrary}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title={serverCopy.title}
          description={serverCopy.preview}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/workspace/servers"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {serverCopy.openAll}
              </Link>
              <Link
                href="/workspace/servers/new"
                className="text-xs font-semibold text-accent hover:underline"
              >
                {dictionary.workspace.registerServer}
              </Link>
            </div>
          }
        />

        {managedServers.length > 0 ? (
          <div className="space-y-3">
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
          <div className="nexus-panel p-8 text-center text-sm text-muted">
            {dictionary.workspace.noServers}
          </div>
        )}
      </section>
    </div>
  );
}
