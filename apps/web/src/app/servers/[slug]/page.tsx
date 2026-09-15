import { notFound } from "next/navigation";
import Link from "next/link";
import { serverService } from "../../../lib/services/server-service";
import {
  Users,
  ShieldCheck,
  Server as ServerIcon,
  Wifi,
  Cpu,
  Layers,
  MapPin,
  ExternalLink,
  Copy,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const server = await serverService.getServerBySlug(slug);

  if (!server) {
    notFound();
  }

  const occupancyPercent = Math.round((server.currentPlayers / server.maxPlayers) * 100);
  const connectUri = `mtasa://${server.ipAddress}:${server.port}`;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Link href="/servers" className="hover:text-white">Servers</Link>
        <span>/</span>
        <span className="text-neutral-200">{server.name}</span>
      </div>

      {/* Hero Banner */}
      <div className="relative rounded-2xl border border-[#232838] overflow-hidden bg-neutral-900 shadow-2xl">
        <div className="h-64 w-full relative">
          {server.bannerUrl && (
            <img
              src={server.bannerUrl}
              alt={server.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/60 to-transparent" />
        </div>

        <div className="p-6 md:p-8 -mt-20 relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>ONLINE</span>
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

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={connectUri}
              className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all"
            >
              Connect to Server
            </a>
          </div>
        </div>
      </div>

      {/* Telemetry and Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-semibold uppercase tracking-wider">Live Player Load</span>
            <Users className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">
            {server.currentPlayers} <span className="text-base font-normal text-neutral-500">/ {server.maxPlayers}</span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
        </div>

        <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-3">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Connection IP</div>
          <div className="font-mono text-base text-white select-all bg-neutral-900 p-2.5 rounded border border-[#232838]">
            {server.ipAddress}:{server.port}
          </div>
          <div className="text-[11px] text-neutral-500">Click to select and paste into MTA Quick Connect</div>
        </div>

        <div className="p-6 rounded-xl border border-[#232838] bg-[#11131a] space-y-3">
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Runtime & Module</div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Nexus Runtime Module 1.0</span>
          </div>
          <div className="text-[11px] text-neutral-400">
            Telemetry synchronization and anti-tamper entitlement active.
          </div>
        </div>
      </div>
    </div>
  );
}
