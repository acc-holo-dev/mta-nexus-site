import Link from "next/link";
import { cookies } from "next/headers";
import {
  entitlementRepository,
  productRepository,
  serverRepository,
} from "@nexus/db";
import { authService } from "../../lib/services/auth-service";
import { SectionHeader, StatCard, StatusBadge } from "@nexus/ui";
import { Box, Plus, Server as ServerIcon, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">
          Sign in to manage your resource library and MTA servers.
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

  const [entitlements, ownedServers, products] = await Promise.all([
    entitlementRepository.listBySubject({ type: "user", id: user.id }),
    serverRepository.listByOwner(user.id),
    productRepository.list(),
  ]);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const downloadable = entitlements.filter(
    (entitlement) => entitlement.permission === "product.download"
  );
  const onlineServers = ownedServers.filter(
    (server) =>
      server.status === "active" &&
      new Date(server.updatedAt).getTime() >= Date.now() - 3 * 60 * 1000
  );
  const onlinePlayers = onlineServers.reduce(
    (total, server) => total + server.currentPlayers,
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-primary">Workspace</h1>
          <p className="font-caption text-muted mt-0.5">
            @{user.username} · your resources and servers
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/workspace/resources/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Publish resource
          </Link>
          <Link
            href="/workspace/servers/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            Register server
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Resources"
          value={downloadable.length}
          tone="purple"
          icon={<Box className="w-4 h-4" />}
          context="in your library"
        />
        <StatCard
          label="Your servers"
          value={ownedServers.length}
          tone="accent"
          icon={<ServerIcon className="w-4 h-4" />}
          context={`${onlineServers.length} online`}
        />
        <StatCard
          label="Players online"
          value={onlinePlayers}
          tone="success"
          icon={<Users className="w-4 h-4" />}
          context="on your servers"
        />
      </div>

      <section>
        <SectionHeader
          title="Resource library"
          description="Free resources you have added"
          action={
            <Link href="/market?maxPrice=0" className="text-xs font-semibold text-accent">
              Browse free resources
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
                      {product?.title || "Unavailable resource"}
                    </div>
                    <div className="text-xs text-neutral-500">
                      Added {new Date(entitlement.createdAt).toLocaleDateString()}
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
            Your library is empty.
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Your servers"
          description="Only servers owned by your account"
          action={
            <Link href="/workspace/servers/new" className="text-xs font-semibold text-accent">
              Register server
            </Link>
          }
        />
        {ownedServers.length > 0 ? (
          <div className="space-y-3">
            {ownedServers.map((server) => {
              const isOnline = onlineServers.some((online) => online.id === server.id);
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
                  <StatusBadge status={isOnline ? "online" : "offline"} tone={isOnline ? "success" : "neutral"} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-neutral-400">
            You have not registered a server yet.
          </div>
        )}
      </section>
    </div>
  );
}
