import type { ManagedServerItem } from "@nexus/db";
import { StatusBadge } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import { getManagedServerCopy } from "../lib/managed-server-view";
import { getServerActivityCopy } from "../lib/server-activity-view";
import { serverContentCopy } from "../lib/server-content-copy";
import { serverStatisticsCopy } from "../lib/server-statistics-copy";
import { type MtaMasterServer, mtaLiveStatus } from "../lib/services/mta-master-directory-service";

export function ManagedServerCard({
  server,
  observation,
  isStale,
  locale,
}: {
  server: ManagedServerItem;
  observation?: MtaMasterServer | null;
  isStale: boolean;
  locale: Locale;
}) {
  const copy = getManagedServerCopy(locale);
  const live = mtaLiveStatus(observation, isStale);
  const players = !isStale && observation?.players != null ? observation.players : null;
  const updated = new Date(server.updatedAt).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    { timeZone: "UTC" },
  );
  return (
    <article className="nexus-panel flex flex-wrap items-start justify-between gap-4 p-4">
      <div className="min-w-0 space-y-2">
        <Link
          href={`/workspace/servers/${encodeURIComponent(server.id)}`}
          className="break-words text-sm font-semibold text-primary hover:text-accent"
        >
          {server.name}
        </Link>
        <p className="break-all font-mono text-xs text-faint">
          {server.ipAddress}:{server.port}
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>{server.organizationId ? copy.organization : copy.personal}</span>
          <span>
            {copy[server.visibility as "public" | "unlisted" | "private"] ?? copy.unknown}
          </span>
          <span>{server.isVerified ? copy.verified : copy.unverified}</span>
        </p>
        <p className="text-xs text-muted">
          {copy.listingStatus}:{" "}
          {copy[server.status as "active" | "inactive" | "maintenance" | "suspended"] ??
            copy.unknown}
        </p>
        <p className="text-xs text-faint">
          {copy.updated}: <time dateTime={server.updatedAt.toISOString()}>{updated} UTC</time>
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{copy.live}:</span>
          <StatusBadge
            status={copy[live]}
            tone={live === "online" ? "success" : live === "offline" ? "danger" : "neutral"}
          />
          {players != null && (
            <span className="text-xs text-secondary">
              {players} {copy.players}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-accent">
          <Link
            href={`/workspace/servers/${encodeURIComponent(server.id)}/content`}
            className="hover:underline"
          >
            {serverContentCopy(locale).title}
          </Link>
          <Link
            href={`/workspace/servers/${encodeURIComponent(server.id)}`}
            className="hover:underline"
          >
            {copy.manage}
          </Link>
          <Link
            href={`/workspace/servers/${encodeURIComponent(server.id)}/activity`}
            className="hover:underline"
          >
            {getServerActivityCopy(locale).open}
          </Link>
          {(server.visibility === "public" || server.visibility === "unlisted") && (
            <Link href={`/servers/${encodeURIComponent(server.slug)}`} className="hover:underline">
              {copy.view}
            </Link>
          )}
          <Link
            href={`/workspace/servers/${encodeURIComponent(server.id)}/statistics`}
            className="hover:underline"
          >
            {serverStatisticsCopy(locale).open}
          </Link>
        </div>
      </div>
    </article>
  );
}
