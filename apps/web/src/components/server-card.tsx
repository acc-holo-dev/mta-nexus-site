import React from "react";
import Link from "next/link";
import { Users, ShieldCheck, Gamepad2, Wifi } from "lucide-react";
import type { Server } from "@nexus/domain";

export function ServerCard({ server }: { server: Server }) {
  const occupancyPercent = Math.round((server.currentPlayers / server.maxPlayers) * 100);

  return (
    <Link
      href={`/servers/${server.slug}`}
      className="group flex flex-col rounded-xl border border-[#232838] bg-[#11131a] hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all overflow-hidden"
    >
      <div className="relative h-32 w-full bg-neutral-900 overflow-hidden">
        {server.bannerUrl ? (
          <img
            src={server.bannerUrl}
            alt={server.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#11131a] via-transparent to-transparent" />
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm border border-neutral-700 text-xs text-emerald-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>ONLINE</span>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
            {server.name}
          </h3>
          {server.isVerified && (
            <span title="Verified Server">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-400 mb-3">
          <Gamepad2 className="w-3.5 h-3.5 text-neutral-500" />
          <span className="truncate">{server.gameMode || "Freeroam"}</span>
          <span className="text-neutral-600">•</span>
          <span className="truncate text-neutral-500">{server.mapName || "San Andreas"}</span>
        </div>

        <p className="text-xs text-neutral-400 line-clamp-2 mb-4 flex-1">
          {server.description}
        </p>

        {/* Players bar */}
        <div className="space-y-1.5 pt-3 border-t border-[#1e2230]">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-neutral-400 font-medium">
              <Users className="w-3.5 h-3.5 text-neutral-500" />
              <span>{server.currentPlayers} / {server.maxPlayers} players</span>
            </span>
            <span className="font-mono text-[11px] text-neutral-500">{occupancyPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, occupancyPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
