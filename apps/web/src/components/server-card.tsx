import React from "react";
import Link from "next/link";
import { Gamepad2, Users } from "lucide-react";
import { TrustBadge } from "@nexus/ui";
import type { Server } from "@nexus/domain";
import { getDictionary, type Locale } from "../lib/i18n";

export function ServerCard({
  server,
  locale = "en",
}: {
  server: Server;
  locale?: Locale;
}) {
  const copy = getDictionary(locale).servers;
  const hasLiveData =
    server.currentPlayers != null && server.maxPlayers != null;
  const occupancyPercent = hasLiveData
    ? Math.round(
        (server.currentPlayers! / Math.max(1, server.maxPlayers!)) * 100,
      )
    : null;
  const isOnline = hasLiveData && server.status === "active";
  const liveLabel = hasLiveData
    ? isOnline
      ? copy.online
      : copy.offline
    : copy.unknown;

  return (
    <Link
      href={`/servers/${server.slug}`}
      className="group flex flex-col overflow-hidden nexus-panel transition-all hover:border-strong hover:shadow-nexus"
    >
      <div className="relative h-28 w-full overflow-hidden bg-inset">
        {server.bannerUrl ? (
          <img
            src={server.bannerUrl}
            alt={server.name}
            width={640}
            height={224}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[color:var(--nexus-inset)] to-[color:var(--nexus-surface)]" />
        )}

        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 font-numeric text-[11px] font-bold text-white backdrop-blur-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              isOnline
                ? "animate-pulse bg-[var(--nexus-success)]"
                : "bg-[var(--nexus-text-faint)]"
            }`}
            aria-hidden="true"
          />
          <span>{liveLabel}</span>
        </div>

        {server.isVerified && (
          <div className="absolute bottom-2 left-2">
            <TrustBadge
              variant="verifiedServer"
              label={copy.verifiedServer}
            />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-1 text-xs font-heading text-primary transition-colors group-hover:text-accent">
          {server.name}
        </h3>

        <div className="flex items-center gap-2 font-caption text-muted">
          <Gamepad2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{server.gameMode || copy.freeroam}</span>
        </div>

        <p className="line-clamp-2 flex-1 font-caption text-muted">
          {server.description}
        </p>

        <div className="space-y-1.5 border-t border-base pt-2.5">
          <div className="flex items-center justify-between font-caption">
            <span className="flex items-center gap-1 font-medium text-secondary">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-numeric">
                {hasLiveData
                  ? `${server.currentPlayers} / ${server.maxPlayers}`
                  : copy.unknown}
              </span>
            </span>
            <span className="font-numeric text-faint">
              {occupancyPercent == null ? "—" : `${occupancyPercent}%`}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-[var(--nexus-success)] transition-all duration-500"
              style={{
                width: `${
                  occupancyPercent == null
                    ? 0
                    : Math.min(100, occupancyPercent)
                }%`,
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
