import { safeExternalWebUrl } from "@nexus/validation";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Cpu, Users } from "lucide-react";
import { TrustBadge } from "@nexus/ui";
import { serverService } from "../../../lib/services/server-service";
import {
  matchesMtaEndpoint,
  mtaLiveStatus,
  mtaMasterDirectoryService,
} from "../../../lib/services/mta-master-directory-service";
import { ServerFollowButton } from "../../../components/server-follow-button";
import { serverHistoryService } from "../../../lib/services/server-history-service";
import { parseServerHistoryWindow } from "../../../lib/server-history-window";
import { ServerHistoryPanel } from "../../../components/server-history-panel";
import { contentService } from "../../../lib/services/content-service";
import { ServerUpdatesPanel } from "../../../components/server-updates-panel";
import { ServerClaimControlPanel } from "../../../components/server-claim-control-panel";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { serverStatisticsCopy } from "../../../lib/server-statistics-copy";
import { cache } from "react";

export const dynamic = "force-dynamic";

const getServer = cache((slug: string) => serverService.getServerBySlug(slug));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [locale, server] = await Promise.all([getRequestLocale(), getServer(slug)]);
  const copy = getDictionary(locale).serverDetail;

  if (!server || server.visibility === "private") {
    return { title: copy.notFound };
  }

  const description =
    server.description?.slice(0, 155) ||
    (server.gameMode ? `${server.gameMode} ${copy.serverFallback}` : copy.serverFallback);

  return {
    title: server.name,
    description,
    alternates: { canonical: `/servers/${server.slug}` },
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ history?: string | string[] }>;
}) {
  const { slug } = await params;
  const [locale, server, query] = await Promise.all([
    getRequestLocale(),
    getServer(slug),
    searchParams,
  ]);
  const historyWindow = parseServerHistoryWindow(query?.history);
  const dictionary = getDictionary(locale);
  const copy = dictionary.serverDetail;
  const serverCopy = dictionary.servers;

  if (!server || server.visibility === "private") notFound();

  const websiteUrl = safeExternalWebUrl(server.websiteUrl);
  const discordUrl = safeExternalWebUrl(server.discordUrl);
  const rulesUrl = safeExternalWebUrl(server.rulesUrl);
  const mediaUrls = (server.mediaUrls ?? [])
    .slice(0, 8)
    .map(safeExternalWebUrl)
    .filter((url): url is string => url !== undefined);

  const [directory, history, serverUpdates] = await Promise.all([
    mtaMasterDirectoryService.getDirectory().catch(() => null),
    serverHistoryService.getHistoryForServer(server, historyWindow).catch(() => null),
    contentService.listServerUpdates(server.id, 6).catch(() => null),
  ]);

  const observedServer = directory?.servers.find((item) => matchesMtaEndpoint(server, item));
  const directoryIsStale = directory?.isStale ?? false;

  const liveStatus = mtaLiveStatus(observedServer, directoryIsStale);
  const isOnline = liveStatus === "online";
  const currentPlayers = directoryIsStale ? undefined : observedServer?.players;
  const maxPlayers = observedServer?.maxPlayers ?? server.maxPlayers;
  const occupancyPercent =
    currentPlayers == null || maxPlayers == null || maxPlayers === 0
      ? 0
      : Math.min(100, Math.round((currentPlayers / maxPlayers) * 100));
  const connectUri = `mtasa://${server.ipAddress}:${server.port}`;
  const statusClass = isOnline
    ? "border-[color:var(--nexus-success)]/30 bg-success-soft text-success"
    : "border-base bg-inset text-secondary";
  const dotClass = isOnline
    ? "animate-pulse bg-[var(--nexus-success)]"
    : "bg-[var(--nexus-text-faint)]";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-xs text-muted">
        <Link href="/servers" className="transition-colors hover:text-primary">
          {copy.breadcrumb}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-secondary">{server.name}</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-base bg-surface shadow-nexus-lg">
        <div className="relative h-64 w-full bg-inset">
          {server.bannerUrl && (
            <>
              {/* biome-ignore lint/performance/noImgElement: server-controlled remote banner stays outside the trusted image-optimizer allowlist. */}
              <img
                src={server.bannerUrl}
                alt={server.name}
                width={1600}
                height={640}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--nexus-page)] via-[color:var(--nexus-page)]/60 to-transparent" />
        </div>

        <div className="relative -mt-20 flex flex-col justify-between gap-6 p-6 md:flex-row md:items-end md:p-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-numeric text-xs font-bold ${statusClass}`}
              >
                <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
                <span>
                  {liveStatus === "online"
                    ? serverCopy.online
                    : liveStatus === "offline"
                      ? serverCopy.offline
                      : serverCopy.unknown}
                </span>
              </span>
              {server.isVerified && (
                <TrustBadge variant="verifiedServer" label={copy.verifiedIdentity} />
              )}
            </div>
            <h1 className="text-2xl font-black text-primary md:text-4xl">{server.name}</h1>
            {server.description && (
              <p className="max-w-2xl text-xs leading-relaxed text-muted">{server.description}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap md:max-w-md md:justify-end">
            <Link
              href={`/servers/${encodeURIComponent(server.slug)}/statistics?window=${historyWindow}`}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-base bg-inset px-4 py-3 text-sm font-semibold text-accent"
            >
              {serverStatisticsCopy(locale).open}
            </Link>
            <ServerFollowButton serverId={server.id} serverName={server.name} />
            <a
              href={connectUri}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-success-solid px-6 py-3 text-sm font-bold text-white shadow-nexus transition-opacity hover:opacity-90"
            >
              {copy.connect}
            </a>
          </div>
        </div>
      </div>

      {!server.organizationId && !server.ownerId && !server.isVerified && (
        <ServerClaimControlPanel serverId={server.id} serverName={server.name} />
      )}

      {(server.language ||
        server.region ||
        websiteUrl ||
        discordUrl ||
        rulesUrl ||
        server.gameplayTags?.length ||
        mediaUrls?.length) && (
        <section className="nexus-panel space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
            {server.language && (
              <span className="rounded border border-base bg-inset px-2 py-1">
                {copy.language}: {server.language}
              </span>
            )}
            {server.region && (
              <span className="rounded border border-base bg-inset px-2 py-1">
                {copy.region}: {server.region}
              </span>
            )}
            {server.gameplayTags?.map((tag) => (
              <span
                key={tag}
                className="rounded border border-[color:var(--nexus-accent)]/20 bg-accent-soft px-2 py-1 text-accent"
              >
                #{tag}
              </span>
            ))}
          </div>

          {(websiteUrl || discordUrl || rulesUrl) && (
            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {copy.website} ↗
                </a>
              )}
              {discordUrl && (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Discord ↗
                </a>
              )}
              {rulesUrl && (
                <a
                  href={rulesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {copy.rules} ↗
                </a>
              )}
            </div>
          )}

          {mediaUrls && mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {mediaUrls.slice(0, 8).map((mediaUrl) => (
                <a
                  key={mediaUrl}
                  href={mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-base bg-inset px-3 py-4 text-center text-[11px] text-muted transition-colors hover:border-strong hover:bg-hover hover:text-primary"
                >
                  {copy.openMedia} ↗
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      <ServerHistoryPanel history={history} locale={locale} />

      <ServerUpdatesPanel updates={serverUpdates} locale={locale} serverSlug={server.slug} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="nexus-panel space-y-4 p-6">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold uppercase tracking-wider">{copy.livePlayerLoad}</span>
            <Users className="h-4 w-4 text-success" aria-hidden="true" />
          </div>
          <div className="text-3xl font-black text-primary">
            {currentPlayers ?? "—"}{" "}
            <span className="text-base font-normal text-faint">/ {maxPlayers ?? "—"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-[var(--nexus-success)]"
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
          {!observedServer && <div className="text-[11px] text-faint">{copy.noObservation}</div>}
          {directoryIsStale && <div className="text-[11px] text-warning">{copy.staleSnapshot}</div>}
        </div>

        <div className="nexus-panel space-y-3 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {copy.connectionIp}
          </div>
          <div className="select-all rounded border border-base bg-inset p-2.5 font-mono text-base text-primary">
            {server.ipAddress}:{server.port}
          </div>
          <div className="text-[11px] text-faint">{copy.selectHint}</div>
        </div>

        <div className="nexus-panel space-y-3 p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {copy.runtime}
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="text-sm font-semibold text-primary">{copy.officialDirectory}</span>
          </div>
          <div className="text-[11px] leading-relaxed text-muted">{copy.runtimeDescription}</div>
        </div>
      </div>
    </div>
  );
}
