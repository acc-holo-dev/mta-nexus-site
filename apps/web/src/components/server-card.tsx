"use client";

import type { Server } from "@nexus/domain";
import { Button, ErrorState, TrustBadge } from "@nexus/ui";
import { Copy, Gamepad2, Users } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { getDictionary, type Locale } from "../lib/i18n";
import { type MtaMasterServer, mtaLiveStatus } from "../lib/mta-master-directory-shared";

function playerCountLabel(
  players: number | undefined,
  maxPlayers: number | undefined,
  unknown: string,
) {
  if (players == null) return unknown;
  return `${players} / ${maxPlayers ?? "?"}`;
}

function CopyAddressControl({
  address,
  name,
  locale,
}: {
  address: string;
  name: string;
  locale: Locale;
}) {
  const copy = getDictionary(locale).servers;
  const addressInput = useRef<HTMLInputElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [copying, setCopying] = useState(false);

  async function copyAddress() {
    setCopying(true);
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(address);
      setCopyMessage(`${copy.copied}: ${address}`);
    } catch {
      addressInput.current?.focus();
      addressInput.current?.select();
      setCopyMessage(copy.copyUnavailable);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] text-muted">
        {copy.serverAddress}
        <input
          ref={addressInput}
          aria-label={`${copy.serverAddress}: ${name}`}
          readOnly
          value={address}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-1 w-full rounded-lg border border-base bg-inset px-2.5 py-1.5 font-mono text-xs text-primary"
        />
      </label>
      <Button
        type="button"
        variant="secondary"
        size="touch"
        aria-label={`${copy.copyAddress}: ${name}`}
        disabled={copying}
        onClick={() => void copyAddress()}
        className="gap-1.5"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        {copying ? copy.copying : copy.copyAddress}
      </Button>
      {copyMessage === copy.copyUnavailable ? (
        <ErrorState id="server-card-copy-unavailable" title={copy.copyUnavailable} />
      ) : copyMessage ? (
        <p role="status" className="text-[11px] text-secondary [overflow-wrap:anywhere]">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
}

export function ServerCard({
  server,
  locale = "en",
  observation,
  isStale = false,
}: {
  server: Pick<
    Server,
    | "id"
    | "slug"
    | "name"
    | "description"
    | "gameMode"
    | "bannerUrl"
    | "maxPlayers"
    | "isVerified"
    | "ipAddress"
    | "port"
  >;
  locale?: Locale;
  observation?: MtaMasterServer | null;
  isStale?: boolean;
}) {
  const copy = getDictionary(locale).servers;
  const liveStatus = mtaLiveStatus(observation, isStale);
  const livePlayers = liveStatus === "online" ? observation?.players : undefined;
  const hasLiveData = livePlayers != null;
  const maxPlayers = observation?.maxPlayers ?? server.maxPlayers;
  const occupancyPercent =
    hasLiveData && maxPlayers != null && maxPlayers > 0
      ? Math.round((livePlayers / maxPlayers) * 100)
      : null;
  const isOnline = liveStatus === "online";
  const liveLabel =
    liveStatus === "online" ? copy.online : liveStatus === "offline" ? copy.offline : copy.unknown;
  const profileHref = `/servers/${encodeURIComponent(server.slug)}`;
  const connectUri = `mtasa://${server.ipAddress}:${server.port}`;
  const address = `${server.ipAddress}:${server.port}`;

  return (
    <article className="group flex flex-col overflow-hidden nexus-panel transition-all hover:border-strong hover:shadow-nexus">
      <Link
        href={profileHref}
        className="relative block h-28 w-full overflow-hidden bg-inset"
        aria-label={`${server.name}`}
      >
        {server.bannerUrl ? (
          <>
            {/* biome-ignore lint/performance/noImgElement: server-controlled remote banner stays outside the trusted image-optimizer allowlist. */}
            <img
              src={server.bannerUrl}
              alt=""
              width={640}
              height={224}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </>
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[color:var(--nexus-inset)] to-[color:var(--nexus-surface)]" />
        )}

        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 font-numeric text-[11px] font-bold text-white backdrop-blur-sm">
          <span
            className={`h-2 w-2 rounded-full ${
              isOnline ? "animate-pulse bg-[var(--nexus-success)]" : "bg-[var(--nexus-text-faint)]"
            }`}
            aria-hidden="true"
          />
          <span>{liveLabel}</span>
        </div>

        {server.isVerified && (
          <div className="absolute bottom-2 left-2">
            <TrustBadge variant="verifiedServer" label={copy.verifiedServer} />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <h3 className="line-clamp-1 text-xs font-heading text-primary">
          <Link
            href={profileHref}
            className="transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {server.name}
          </Link>
        </h3>

        <div className="flex items-center gap-2 font-caption text-muted">
          <Gamepad2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{server.gameMode || copy.freeroam}</span>
        </div>

        <p className="line-clamp-2 flex-1 font-caption text-muted">{server.description}</p>

        <div className="space-y-1.5 border-t border-base pt-2.5">
          <div className="flex items-center justify-between font-caption">
            <span className="flex items-center gap-1 font-medium text-secondary">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="font-numeric">
                {playerCountLabel(hasLiveData ? livePlayers : undefined, maxPlayers, copy.unknown)}
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
                width: `${occupancyPercent == null ? 0 : Math.min(100, occupancyPercent)}%`,
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-base pt-2.5">
          <a
            href={connectUri}
            aria-label={`${copy.connect}: ${server.name}`}
            className="inline-flex items-center rounded-lg border border-base bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.connect}
          </a>
          <Link
            href={profileHref}
            className="inline-flex items-center rounded-lg border border-base px-3 py-1.5 text-xs font-semibold text-secondary hover:text-primary"
          >
            {getDictionary(locale).notificationBell.view}
          </Link>
        </div>

        <CopyAddressControl address={address} name={server.name} locale={locale} />
      </div>
    </article>
  );
}

/** Home/directory spotlight for an official master-list row; profile only when matched. */
export function HomeNetworkServerCard({
  observation,
  locale = "en",
  profileSlug,
  isStale = false,
}: {
  observation: MtaMasterServer;
  locale?: Locale;
  profileSlug?: string;
  isStale?: boolean;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.servers;
  const home = dictionary.home;
  const address = `${observation.address}:${observation.port}`;
  const name = observation.name?.trim() || address;
  const connectUri = `mtasa://${observation.address}:${observation.port}`;
  const playersLabel = isStale
    ? copy.unknown
    : playerCountLabel(observation.players, observation.maxPlayers, copy.playersUnknown);

  return (
    <article aria-label={name} className="nexus-panel flex flex-col gap-3 p-5">
      <div className="min-w-0 space-y-1">
        <h3 className="truncate text-sm font-bold text-primary">{name}</h3>
        <p className="truncate text-xs text-muted">
          {[observation.gameMode, observation.mapName].filter(Boolean).join(" · ") || address}
        </p>
      </div>

      <p className="text-sm font-semibold text-success">
        {playersLabel}
        {!isStale && observation.players != null ? ` ${home.players}` : null}
      </p>

      <div className="flex flex-wrap gap-2">
        <a
          href={connectUri}
          aria-label={`${copy.connect}: ${name}`}
          className="inline-flex items-center rounded-lg border border-base bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.connect}
        </a>
        {profileSlug ? (
          <Link
            href={`/servers/${encodeURIComponent(profileSlug)}`}
            className="inline-flex items-center rounded-lg border border-base px-3 py-1.5 text-xs font-semibold text-secondary hover:text-primary"
          >
            {dictionary.notificationBell.view}
          </Link>
        ) : null}
      </div>

      <CopyAddressControl address={address} name={name} locale={locale} />
    </article>
  );
}
