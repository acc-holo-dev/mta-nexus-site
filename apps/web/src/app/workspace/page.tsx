import Link from "next/link";
import { cookies } from "next/headers";
import {
  entitlementRepository,
  licenseRepository,
  productRepository,
  serverRepository,
} from "@nexus/db";
import { Box, Plus, Server as ServerIcon, Users } from "lucide-react";
import { SectionHeader, StatCard, StatusBadge } from "@nexus/ui";
import { authService } from "../../lib/services/auth-service";
import {
  indexMtaObservations,
  mtaLiveStatus,
  mtaMasterDirectoryService,
} from "../../lib/services/mta-master-directory-service";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { collectLibraryEntries } from "../../lib/user-library";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const token = (await cookies()).get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-20 text-center">
        <h1 className="font-display text-primary">
          {dictionary.workspace.signInRequired}
        </h1>
        <p className="font-caption text-muted">
          {dictionary.workspace.signInMessage}
        </p>
        <Link
          href="/auth/login"
          className="inline-block rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
        >
          {dictionary.workspace.signIn}
        </Link>
      </div>
    );
  }

  const [entitlements, legacyLicenses, ownedServers] = await Promise.all([
    entitlementRepository.listBySubject({ type: "user", id: user.id }),
    licenseRepository.listActiveDownloadableByUser(user.id),
    serverRepository.listByOwner(user.id),
  ]);

  const downloadable = collectLibraryEntries(entitlements, legacyLicenses);
  const [products, directory] = await Promise.all([
    productRepository.listPublishedFreeByIds(
      downloadable.map((entitlement) => entitlement.resourceId),
    ),
    ownedServers.length > 0
      ? mtaMasterDirectoryService.getDirectory().catch(() => null)
      : Promise.resolve(null),
  ]);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const observationFor = indexMtaObservations(directory?.servers ?? []);
  const directoryIsFresh = Boolean(directory && !directory.isStale);
  const liveByServerId = new Map(
    ownedServers.map((server) => [
      server.id,
      observationFor(server) ?? null,
    ]),
  );
  const onlineServers = ownedServers.filter((server) => {
    const observation = liveByServerId.get(server.id);
    return mtaLiveStatus(observation, !directoryIsFresh) === "online";
  });
  const onlinePlayers = onlineServers.reduce(
    (total, server) =>
      total + (liveByServerId.get(server.id)?.players ?? 0),
    0,
  );
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-4 border-b border-base pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-primary">
            {dictionary.workspace.title}
          </h1>
          <p className="mt-0.5 font-caption text-muted">
            @{user.username} · {dictionary.workspace.subtitle}
          </p>
          <p className="mt-1 max-w-2xl font-caption text-faint">
            {dictionary.workspace.liveNote}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
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
          value={downloadable.length}
          tone="purple"
          icon={<Box className="h-4 w-4" />}
          context={dictionary.workspace.inLibrary}
        />
        <StatCard
          label={dictionary.workspace.yourServers}
          value={ownedServers.length}
          tone="accent"
          icon={<ServerIcon className="h-4 w-4" />}
          context={directoryIsFresh
            ? `${onlineServers.length} ${dictionary.workspace.online}`
            : dictionary.workspace.liveUnavailable}
        />
        <StatCard
          label={dictionary.workspace.playersOnline}
          value={directoryIsFresh ? onlinePlayers : "—"}
          tone="success"
          icon={<Users className="h-4 w-4" />}
          context={dictionary.workspace.onServers}
        />
      </div>

      <section>
        <SectionHeader
          title={dictionary.workspace.libraryTitle}
          description={dictionary.workspace.libraryDescription}
          action={
            <Link
              href="/market?maxPrice=0"
              className="text-xs font-semibold text-accent hover:underline"
            >
              {dictionary.workspace.browseResources}
            </Link>
          }
        />

        {downloadable.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {downloadable.map((entitlement) => {
              const product = productMap.get(entitlement.resourceId);
              return (
                <article
                  key={entitlement.resourceId}
                  className="nexus-panel flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-primary">
                      {product?.title ||
                        dictionary.workspace.unavailableResource}
                    </div>
                    <div className="text-xs text-faint">
                      {dictionary.workspace.added}{" "}
                      {new Date(entitlement.createdAt).toLocaleDateString(
                        dateLocale,
                      )}
                    </div>
                  </div>
                  {product && (
                    <Link
                      href={`/market/${product.slug}`}
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
          title={dictionary.workspace.yourServers}
          description={dictionary.workspace.serversDescription}
          action={
            <Link
              href="/workspace/servers/new"
              className="text-xs font-semibold text-accent hover:underline"
            >
              {dictionary.workspace.registerServer}
            </Link>
          }
        />

        {ownedServers.length > 0 ? (
          <div className="space-y-3">
            {ownedServers.map((server) => {
              const observation = liveByServerId.get(server.id);
              const liveStatus = mtaLiveStatus(observation, !directoryIsFresh);
              const isOnline = liveStatus === "online";
              const isOffline = liveStatus === "offline";
              const status = isOnline
                ? dictionary.servers.online
                : isOffline
                  ? dictionary.servers.offline
                  : dictionary.servers.unknown;

              return (
                <article
                  key={server.id}
                  className="nexus-panel flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/servers/${server.slug}`}
                      className="text-sm font-semibold text-primary transition-colors hover:text-accent"
                    >
                      {server.name}
                    </Link>
                    <div className="font-mono text-xs text-faint">
                      {server.ipAddress}:{server.port}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/workspace/servers/${server.id}`}
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      {dictionary.workspace.manage}
                    </Link>
                    <StatusBadge
                      status={status}
                      tone={
                        isOnline
                          ? "success"
                          : isOffline
                            ? "danger"
                            : "neutral"
                      }
                    />
                  </div>
                </article>
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
