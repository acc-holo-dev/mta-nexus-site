import Link from "next/link";
import type { ManagedServerClaimStatus } from "@nexus/db";
import type { Locale } from "../lib/i18n";
import { getServerClaimStatusCopy } from "../lib/server-claim-status-view";
import { ServerClaimControlPanel } from "./server-claim-control-panel";

export function ServerClaimStatusPanel({
  serverId,
  serverName,
  status,
  locale,
}: {
  serverId: string;
  serverName: string;
  status: ManagedServerClaimStatus;
  locale: Locale;
}) {
  const copy = getServerClaimStatusCopy(locale);
  const request = status.request;
  const waiting = request?.status === "pending";
  const dateLabel = (date: Date) => `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
  return (
    <div className="space-y-4">
      {(status.isVerified || request) && (
        <section
          className="nexus-panel space-y-3 p-5"
          aria-labelledby="server-claim-status-heading"
        >
          <h2 id="server-claim-status-heading" className="text-sm font-bold text-primary">
            {copy.title}
          </h2>
          {status.isVerified && (
            <p className="text-sm font-semibold text-success">{copy.verified}</p>
          )}
          {request && (
            <>
              <p className="text-sm font-semibold text-primary">{copy[request.status]}</p>
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
              {!status.isVerified && !request.proofMatchesServer && (
                <p className="text-xs leading-relaxed text-warning">{copy.outdated}</p>
              )}
              {!status.isVerified && (
                <p className="text-xs leading-relaxed text-muted">
                  {waiting ? copy.wait : copy.retry}
                </p>
              )}
            </>
          )}
          <Link
            href={`/workspace/servers/${encodeURIComponent(serverId)}`}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {copy.refresh}
          </Link>
        </section>
      )}
      {!status.isVerified && !waiting && (
        <ServerClaimControlPanel serverId={serverId} serverName={serverName} refreshOnSuccess />
      )}
    </div>
  );
}
