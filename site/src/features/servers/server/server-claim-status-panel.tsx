import type { ManagedServerClaimStatus } from "@nexus/db";
import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import { linkAccentSmSemibold } from "../../shell/link-shell";
import { pageShellStack4 } from "../../shell/page-shell";
import { panelClipSpace3P5 } from "../../shell/panel-shell";
import { typeSmSemiboldPrimary } from "../../shell/type-shell";
import { ServerClaimControlPanel } from "../components/server-claim-control-panel";
import { getServerClaimStatusCopy } from "../server-claim-status-view";
export function ServerClaimStatusPanel({
  serverId,
  serverName,
  actorId,
  status,
  locale,
}: {
  serverId: string;
  serverName: string;
  actorId: string;
  status: ManagedServerClaimStatus;
  locale: Locale;
}) {
  const copy = getServerClaimStatusCopy(locale);
  const request = status.request;
  const waiting = request?.status === "pending";
  const dateLabel = (date: Date) => `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
  return (
    <div className={pageShellStack4}>
      {(status.isVerified || request) && (
        <section className={panelClipSpace3P5} aria-labelledby="server-claim-status-heading">
          <h2 id="server-claim-status-heading" className="text-sm font-bold text-primary">
            {copy.title}
          </h2>
          {status.isVerified && (
            <p className="text-sm font-semibold text-success">{copy.verified}</p>
          )}
          {request && (
            <>
              <p className={typeSmSemiboldPrimary}>{copy[request.status]}</p>
              <p className="text-xs text-muted">
                {request.isRequester ? copy.yourRequest : copy.teamRequest}
              </p>
              <p className="text-xs text-muted">
                {copy.created}:{" "}
                <time dateTime={request.createdAt.toISOString()}>
                  {dateLabel(request.createdAt)}
                </time>
              </p>
              {request.resolvedAt && (
                <p className="text-xs text-muted">
                  {copy.resolved}:{" "}
                  <time dateTime={request.resolvedAt.toISOString()}>
                    {dateLabel(request.resolvedAt)}
                  </time>
                </p>
              )}
              {!status.isVerified && !request.proofMatchesServer ? (
                <ErrorState title={copy.outdated} description={copy.outdatedHint} />
              ) : null}
              {!status.isVerified && (
                <p className="text-xs leading-relaxed text-muted">
                  {waiting ? copy.wait : copy.retry}
                </p>
              )}
            </>
          )}
          <Link
            href={`/workspace/servers/${encodeURIComponent(serverId)}`}
            className={linkAccentSmSemibold}
          >
            {copy.refresh}
          </Link>
        </section>
      )}
      {!status.isVerified && !waiting && (
        <ServerClaimControlPanel
          key={`${actorId}:${serverId}`}
          serverId={serverId}
          serverName={serverName}
          expectedActorId={actorId}
          refreshOnSuccess
        />
      )}
    </div>
  );
}
