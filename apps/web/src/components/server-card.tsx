import React from "react";
import Link from "next/link";
import { Users, Gamepad2 } from "lucide-react";
import { TrustBadge } from "@nexus/ui";
import type { Server } from "@nexus/domain";

export function ServerCard({ server }: { server: Server }) {
  const occupancyPercent = Math.round((server.currentPlayers / Math.max(1, server.maxPlayers)) * 100);
  const isOnline = server.status === "active" || server.currentPlayers > 0;

  return (
    <Link
      href={`/servers/${server.slug}`}
      className="group flex flex-col nexus-panel overflow-hidden hover:border-strong hover:shadow-nexus transition-all"
    >
      {/* Banner */}
      <div className="relative h-28 w-full bg-inset overflow-hidden">
        {server.bannerUrl ? (
          <img
            src={server.bannerUrl}
            alt={server.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[color:var(--nexus-inset)] to-[color:var(--nexus-surface)]" />
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm font-numeric text-[11px] font-bold text-white">
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-neutral-400"}`}
          />
          <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
        </div>
        {server.isVerified && (
          <div className="absolute bottom-2 left-2">
            <TrustBadge variant="verifiedServer" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col flex-1 gap-2">
        <h3 className="text-xs font-heading text-primary group-hover:text-accent transition-colors line-clamp-1">
          {server.name}
        </h3>

        <div className="flex items-center gap-2 font-caption text-muted">
          <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{server.gameMode || "Freeroam"}</span>
        </div>

        <p className="font-caption text-muted line-clamp-2 flex-1">{server.description}</p>

        {/* Player load */}
        <div className="space-y-1.5 pt-2.5 border-t border-base">
          <div className="flex items-center justify-between font-caption">
            <span className="flex items-center gap-1 text-secondary font-medium">
              <Users className="w-3.5 h-3.5" />
              <span className="font-numeric">
                {server.currentPlayers} / {server.maxPlayers}
              </span>
            </span>
            <span className="font-numeric text-faint">{occupancyPercent}%</span>
          </div>
          <div className="w-full h-1 bg-inset rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, occupancyPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
