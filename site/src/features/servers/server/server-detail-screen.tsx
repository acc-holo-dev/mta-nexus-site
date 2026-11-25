import { followWorkspaceRepository } from "@nexus/db";
import { ErrorState, TrustBadge } from "@nexus/ui";
import { safeExternalWebUrl } from "@nexus/validation";
import { Cpu, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDictionary } from "../../../lib/i18n";
import { getRequestCookieStore, getRequestLocale } from "../../../lib/i18n/server";
import { formatUnknown } from "../../../lib/i18n/unknown";
import { authService } from "../../../lib/services/accounts/auth-service";
import { contentService } from "../../../lib/services/community/content-service";
import {
  matchesMtaEndpoint,
  mtaLiveStatus,
  mtaMasterDirectoryService,
} from "../../../lib/services/servers/mta-master-directory-service";
import { serverHistoryService } from "../../../lib/services/servers/server-history-service";
import { serverReviewService } from "../../../lib/services/servers/server-review-service";
import { serverService } from "../../../lib/services/servers/server-service";
import { buildFollowInitialState } from "../../community/follow-initial-state";
import { ObjectReportForm } from "../../moderation/object-report";
import { authEntryHref } from "../../shell/auth-return";
import { linkAccentTightHover } from "../../shell/link-shell";
import { pageShellStack8 } from "../../shell/page-shell";
import { panelSpace3P6, panelSpace4P5, panelSpace4P6 } from "../../shell/panel-shell";
import {
  type3xlBlackPrimary,
  typeCoverFull,
  typeElevenFaint,
  typeFlexCenterGap2,
  typeFlexWrapCenterGap2,
  typeGridCols1Gap6Md3,
  typeHoverPrimary,
  typeIcon4Success,
  typeIconAccent,
  typeSmSemiboldPrimary,
} from "../../shell/type-shell";
import { contextTrustCopy } from "../../trust/public-context-trust-copy";
import { ServerClaimControlPanel } from "../claim-controls";
import { ServerConnectControls } from "../connect";
import { ServerFollowButton } from "../follow";
import { ServerHistoryPanel } from "../history-server";
import { ServerReviewPanel } from "../review-controls";
import { parseServerHistoryWindow } from "../server-history-window";
import { serverStatisticsCopy } from "../server-statistics-copy";
import { ServerUpdatesPanel } from "../updates-server";

const getServer = cache((slug: string) => serverService.getServerBySlug(slug));

export async function serverDetailMetadata({
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

export async function ServerDetailScreen({
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

  let reportViewer: { id: string } | null = null;
  let followViewer: { id: string } | null | undefined;
  let claimViewer: { id: string } | null | undefined;
  const claimable = !server.organizationId && !server.ownerId && !server.isVerified;
  try {
    const store = await getRequestCookieStore();
    reportViewer = await authService.getSession(store.get("nexus_session")?.value);
    followViewer = reportViewer;
    if (claimable) claimViewer = reportViewer;
  } catch {
    // Probe failure is not a guest: leave followViewer undefined (error seed) and
    // mark claim/report controls as unavailable instead of inventing a signed-out viewer.
    reportViewer = null;
    followViewer = undefined;
    if (claimable) claimViewer = undefined;
  }
  const serverReturnPath = `/servers/${encodeURIComponent(server.slug)}`;

  const websiteUrl = safeExternalWebUrl(server.websiteUrl);
  const discordUrl = safeExternalWebUrl(server.discordUrl);
  const rulesUrl = safeExternalWebUrl(server.rulesUrl);
  const mediaUrls = (server.mediaUrls ?? [])
    .slice(0, 8)
    .map(safeExternalWebUrl)
    .filter((url): url is string => url !== undefined);

  const [directory, history, serverUpdates, reviewPage, savedFollowIds, serverMute] =
    await Promise.all([
      mtaMasterDirectoryService.getDirectory().catch(() => null),
      serverHistoryService.getHistoryForServer(server, historyWindow).catch(() => null),
      contentService.listServerUpdates(server.id, 6).catch(() => null),
      server.visibility === "public" && server.status === "active"
        ? serverReviewService
            .publicPage(server.id)
            .then((page) => ({ state: "ready" as const, page }))
            .catch(() => ({ state: "unavailable" as const }))
        : Promise.resolve(null),
      reportViewer
        ? followWorkspaceRepository.states(reportViewer.id, "server", [server.id]).catch(() => null)
        : Promise.resolve([] as string[]),
      reportViewer
        ? followWorkspaceRepository
            .muteState(reportViewer.id, "server", server.id)
            .catch(() => null)
        : Promise.resolve(null),
    ]);
  const followInitial = buildFollowInitialState({
    actor: followViewer,
    targetId: server.id,
    followedIds: savedFollowIds,
    mute: serverMute,
  });

  const observedServer = directory?.servers.find((item) => matchesMtaEndpoint(server, item));
  const directoryIsStale = directory?.isStale ?? false;

  const liveStatus = mtaLiveStatus(observedServer, directoryIsStale);
  const isOnline = liveStatus === "online";
  const currentPlayers = directoryIsStale ? undefined : observedServer?.players;
  const maxPlayers = observedServer?.maxPlayers ?? server.maxPlayers;
  const occupancyPercent =
    currentPlayers == null || maxPlayers == null || maxPlayers === 0
      ? null
      : Math.min(100, Math.round((currentPlayers / maxPlayers) * 100));
  const connectUri = `mtasa://${server.ipAddress}:${server.port}`;
  const connectAddress = `${server.ipAddress}:${server.port}`;
  const statusClass = isOnline
    ? "border-[color:var(--nexus-success)]/30 bg-success-soft text-success"
    : "border-base bg-inset text-secondary";
  const dotClass = isOnline
    ? "animate-pulse bg-[var(--nexus-success)]"
    : "bg-[var(--nexus-text-faint)]";

  return (
    <div className={pageShellStack8}>
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
        <Link href="/servers" className={typeHoverPrimary}>
          {copy.breadcrumb}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="min-w-0 truncate text-secondary">{server.name}</span>
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
                className={typeCoverFull}
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--nexus-page)] via-[color:var(--nexus-page)]/60 to-transparent" />
        </div>

        <div className="relative -mt-20 flex flex-col justify-between gap-6 p-6 md:flex-row md:items-end md:p-8">
          <div className="space-y-2">
            <div className={typeFlexWrapCenterGap2}>
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
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-base bg-inset px-4 py-3 text-sm font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {serverStatisticsCopy(locale).open}
            </Link>
            {server.visibility === "public" && server.status === "active" && (
              <Link
                href={`/servers/${encodeURIComponent(server.slug)}/trust`}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-base px-4 py-3 text-sm font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                {contextTrustCopy(locale).title}
              </Link>
            )}
            <ServerFollowButton
              serverId={server.id}
              serverName={server.name}
              initial={followInitial}
            />
            <ObjectReportForm
              targetType="server"
              targetId={server.id}
              locale={locale}
              authenticated={followViewer === undefined ? null : Boolean(reportViewer)}
              retryHref={serverReturnPath}
              loginHref={authEntryHref("login", serverReturnPath)}
              registerHref={authEntryHref("register", serverReturnPath)}
            />
            <ServerConnectControls
              address={connectAddress}
              connectUri={connectUri}
              name={server.name}
              locale={locale}
              connectLabel={copy.connect}
              connectHint={copy.connectHint}
            />
          </div>
        </div>
      </div>

      {!server.organizationId &&
        !server.ownerId &&
        !server.isVerified &&
        (claimViewer === undefined ? (
          <ErrorState
            id="server-claim-session-unavailable"
            title={copy.claimSessionUnavailable}
            description={copy.claimSessionUnavailableHint}
          />
        ) : (
          <ServerClaimControlPanel
            key={`${server.id}:${claimViewer?.id ?? "guest"}`}
            serverId={server.id}
            serverName={server.name}
            expectedActorId={claimViewer?.id ?? null}
          />
        ))}

      {(server.language ||
        server.region ||
        websiteUrl ||
        discordUrl ||
        rulesUrl ||
        server.gameplayTags?.length ||
        mediaUrls?.length) && (
        <section className={panelSpace4P5}>
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
                  className={linkAccentTightHover}
                >
                  {copy.website} ↗
                </a>
              )}
              {discordUrl && (
                <a
                  href={discordUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={linkAccentTightHover}
                >
                  {copy.discord} ↗
                </a>
              )}
              {rulesUrl && (
                <a
                  href={rulesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={linkAccentTightHover}
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

      <ServerHistoryPanel
        history={history}
        locale={locale}
        retryHref={`/servers/${encodeURIComponent(server.slug)}`}
      />

      <ServerUpdatesPanel updates={serverUpdates} locale={locale} serverSlug={server.slug} />

      {reviewPage?.state === "ready" ? (
        <ServerReviewPanel serverId={server.id} initialPage={reviewPage.page} />
      ) : reviewPage?.state === "unavailable" ? (
        <ServerReviewPanel serverId={server.id} loadState="unavailable" />
      ) : null}

      <div className={typeGridCols1Gap6Md3}>
        <div className={panelSpace4P6}>
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold uppercase tracking-wider">{copy.livePlayerLoad}</span>
            <Users className={typeIcon4Success} aria-hidden="true" />
          </div>
          <div className={type3xlBlackPrimary}>
            {formatUnknown(locale, currentPlayers)}{" "}
            <span className="text-base font-normal text-faint">
              / {formatUnknown(locale, maxPlayers)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-[var(--nexus-success)]"
              style={{ width: `${occupancyPercent ?? 0}%` }}
              aria-hidden={occupancyPercent == null}
            />
          </div>
          {!directory ? (
            <ErrorState
              id="server-directory-unavailable"
              title={dictionary.servers.unavailable}
              description={dictionary.servers.unavailableHint}
              action={
                <Link href={serverReturnPath} className={linkAccentTightHover}>
                  {dictionary.errors.retry}
                </Link>
              }
            />
          ) : !observedServer ? (
            <div className={typeElevenFaint}>{copy.noObservation}</div>
          ) : null}
          {directoryIsStale ? (
            <ErrorState
              id="server-directory-stale-snapshot"
              title={copy.staleSnapshot}
              description={copy.staleSnapshotHint}
            />
          ) : null}
        </div>

        <div className={panelSpace3P6}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {copy.connectionIp}
          </div>
          <div className="select-all rounded border border-base bg-inset p-2.5 font-mono text-base text-primary">
            {connectAddress}
          </div>
          <div className={typeElevenFaint}>{copy.selectHint}</div>
        </div>

        <div className={panelSpace3P6}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            {copy.runtime}
          </div>
          <div className={typeFlexCenterGap2}>
            <Cpu className={typeIconAccent} aria-hidden="true" />
            <span className={typeSmSemiboldPrimary}>{copy.officialDirectory}</span>
          </div>
          <div className="text-[11px] leading-relaxed text-muted">{copy.runtimeDescription}</div>
        </div>
      </div>
    </div>
  );
}
