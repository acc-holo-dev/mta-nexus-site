import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { serverService } from "../../../lib/services/server-service";
import {
  matchesMtaEndpoint,
  mtaMasterDirectoryService,
} from "../../../lib/services/mta-master-directory-service";
import { Cpu, ShieldCheck, Users } from "lucide-react";

export const dynamic = "force-dynamic";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const server = await serverService.getServerBySlug(slug);

  if (!server) return { title: "Server not found" };

  const description = server.description?.slice(0, 155) || (server.gameMode || "MTA") + " server";
  return {
    title: server.name,
    description,
    alternates: { canonical: "/servers/" + server.slug },
    openGraph: {
      title: server.name,
      description,
      type: "website",
      images: server.bannerUrl ? [{ url: server.bannerUrl }] : undefined,
    },
  };
}

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const server = await serverService.getServerBySlug(slug);

  if (!server) notFound();

  let observedServer: Awaited<ReturnType<typeof mtaMasterDirectoryService.getDirectory>>["servers"][number] | undefined;
  let directoryIsStale = false;
  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    observedServer = directory.servers.find(
      (item) => item.address === server.ipAddress && item.port === server.port
    );
    directoryIsStale = directory.isStale;
  } catch {
    // The editorial server profile remains available when the public directory is unavailable.
  }

  const isOnline = observedServer != null && observedServer.responding !== false;
  const currentPlayers = observedServer?.players;
  const maxPlayers = observedServer?.maxPlayers ?? server.maxPlayers;
  const occupancyPercent = currentPlayers == null || maxPlayers === 0
    ? 0
    : Math.min(100, Math.round((currentPlayers / maxPlayers) * 100));
  const connectUri = "mtasa://" + server.ipAddress + ":" + server.port;
  const statusClass = isOnline
    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    : "bg-neutral-700/50 text-neutral-300 border-neutral-600";
  const dotClass = isOnline ? "bg-emerald-500 animate-pulse" : "bg-neutral-400";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Link href="/servers" className="hover:text-white">Servers</Link>
        <span>/</span>
        <span className="text-neutral-200">{server.name}</span>
      </div>

      <div className="relative rounded-2xl border border-base overflow-hidden bg-neutral-900 shadow-2xl">
        <div className="h-64 w-full relative">
          {server.bannerUrl && (
            <img src={server.bannerUrl} alt={server.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--nexus-page)] via-[color:var(--nexus-page)]/60 to-transparent" />
        </div>

        <div className="p-6 md:p-8 -mt-20 relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={"px-2.5 py-1 rounded-full text-xs font-mono font-bold border flex items-center gap-1.5 " + statusClass}>
                <span className={"w-2 h-2 rounded-full " + dotClass} />
                <span>{observedServer ? (isOnline ? "ONLINE" : "OFFLINE") : "UNKNOWN"}</span>
              </span>
              {server.isVerified && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Identity
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-4xl font-black text-white">{server.name}</h1>
            <p className="text-xs text-neutral-400 max-w-2xl">{server.description}</p>
          </div>

          <a
            href={connectUri}
            className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all"
          >
            Connect to Server
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border border-base bg-surface space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Live Player Load</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">
            {currentPlayers ?? "—"} <span className="text-base font-normal text-neutral-500">/ {maxPlayers}</span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: occupancyPercent + "%" }} />
          </div>
          {!observedServer && (
            <div className="text-[11px] text-neutral-500">No current observation in the official MTA directory.</div>
          )}
          {directoryIsStale && (
            <div className="text-[11px] text-amber-400">Showing the latest available directory snapshot.</div>
          )}
        </div>

        <div className="p-6 rounded-xl border border-base bg-surface space-y-3">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Connection IP</div>
          <div className="font-mono text-base text-white select-all bg-neutral-900 p-2.5 rounded border border-base">
            {server.ipAddress}:{server.port}
          </div>
          <div className="text-[11px] text-neutral-500">Click to select and paste into MTA Quick Connect</div>
        </div>

        <div className="p-6 rounded-xl border border-base bg-surface space-y-3">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Runtime & Module</div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Official MTA directory</span>
          </div>
          <div className="text-[11px] text-neutral-400">
            Live status is based on the latest public MTA directory observation. Editorial server details are managed separately.
          </div>
        </div>
      </div>
    </div>
  );
}
