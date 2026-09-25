import Link from "next/link";
import { cookies } from "next/headers";
import {
  entitlementRepository,
  productRepository,
  serverRepository,
} from "@nexus/db";
import { authService } from "../../lib/services/auth-service";
import {
  matchesMtaEndpoint,
  mtaMasterDirectoryService,
} from "../../lib/services/mta-master-directory-service";
import { SectionHeader, StatCard, StatusBadge } from "@nexus/ui";
import { Box, Plus, Server as ServerIcon, Users } from "lucide-react";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <p className="font-caption text-muted">
          {dictionary.workspace.signInMessage}
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const [entitlements, ownedServers, products, directory] = await Promise.all([
    entitlementRepository.listBySubject({ type: "user", id: user.id }),
    serverRepository.listByOwner(user.id),
    productRepository.list(),
    mtaMasterDirectoryService.getDirectory().catch(() => null),
  ]);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const downloadable = entitlements.filter(
    (entitlement) => entitlement.permission === "product.download"
  );
  const observations = directory?.servers ?? [];
  const liveByServerId = new Map(
    ownedServers.map((server) => [
      server.id,
      observations.find((observation) => matchesMtaEndpoint(server, observation)) ?? null,
    ])
  );
  const onlineServers = ownedServers.filter((server) => {
    const observation = liveByServerId.get(server.id);
    return Boolean(observation && observation.responding !== false);
  });
  const onlinePlayers = onlineServers.reduce(
    (total, server) => total + (liveByServerId.get(server.id)?.players ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-primary">{dictionary.workspace.title}</h1>
          <p className="font-caption text-muted mt-0.5">
            @{user.username} · {dictionary.workspace.subtitle}
          </p>
          <p className="font-caption text-faint mt-1">
            {dictionary.workspace.liveNote}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/workspace/resources/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            {dictionary.workspace.publishResource}
          </Link>
          <Link
            href="/workspace/servers/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            {dictionary.workspace.registerServer}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={dictionary.workspace.resources}
          value={downloadable.length}
          tone="purple"
          icon={<Box className="w-4 h-4" />}
          context={dictionary.workspace.inLibrary}
        />
        <StatCard
          label={dictionary.workspace.yourServers}
          value={ownedServers.length}
          tone="accent"
          icon={<ServerIcon className="w-4 h-4" />}
          context={`${onlineServers.length} ${dictionary.workspace.online}`}
        />
        <StatCard
          label={dictionary.workspace.playersOnline}
          value={onlinePlayers}
          tone="success"
          icon={<Users className="w-4 h-4" />}
          context={dictionary.workspace.onServers}
        />
      </div>

      <section>
        <SectionHeader
          title={dictionary.workspace.libraryTitle}
          description={dictionary.workspace.libraryDescription}
          action={
            <Link href="/market?maxPrice=0" className="text-xs font-semibold text-accent">
              {dictionary.workspace.browseResources}
            </Link>
          }
        />
        {downloadable.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {downloadable.map((entitlement) => {
              const product = productMap.get(entitlement.resourceId);
              return (
                <div key={entitlement.id} className="nexus-panel p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {product?.title || dictionary.workspace.unavailableResource}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {dictionary.workspace.added} {new Date(entitlement.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US")}
                    </div>
                  </div>
                  {product && (
                    <Link href={`/market/${product.slug}`} className="text-xs font-semibold text-accent">
                      Open
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-neutral-400">
            {dictionary.workspace.emptyLibrary}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title={dictionary.workspace.yourServers}
          description={dictionary.workspace.serversDescription}
          action={
            <Link href="/workspace/servers/new" className="text-xs font-semibold text-accent">
              {dictionary.workspace.registerServer}
            </Link>
          }
        />
        {ownedServers.length > 0 ? (
          <div className="space-y-3">
            {ownedServers.map((server) => {
              const observation = liveByServerId.get(server.id);
              const isOnline = Boolean(observation && observation.responding !== false);
              const isOffline = Boolean(observation && observation.responding === false);
              return (
                <div key={server.id} className="nexus-panel p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/servers/${server.slug}`} className="text-sm font-semibold text-white hover:text-accent">
                      {server.name}
                    </Link>
                    <div className="text-xs text-neutral-500 font-mono">
                      {server.ipAddress}:{server.port}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={"/workspace/servers/" + server.id} className="text-xs font-semibold text-accent">
                      Manage
                    </Link>
                    <StatusBadge
                      status={isOnline ? "online" : isOffline ? "offline" : "unknown"}
                      tone={isOnline ? "success" : "neutral"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-neutral-400">
            {dictionary.workspace.noServers}
          </div>
        )}
      </section>
    </div>
  );
}
