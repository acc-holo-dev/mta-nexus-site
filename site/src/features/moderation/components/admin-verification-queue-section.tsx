import { EmptyState, ErrorState, SectionHeader, StatusBadge } from "@nexus/ui";
import { safeExternalWebUrl } from "@nexus/validation";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { getDictionary, Locale } from "../../../lib/i18n";
import { linkAccentTight, linkAccentXsBlock } from "../../shell/link-shell";
import {
  typeCaptionFaint,
  typeCaptionMuted,
  typeFlexWrapCenterGap2,
  typeIconAccent,
  typeMinSpace1,
  typeMt3FlexCenterGap3Xs,
  typeXsSecondary,
} from "../../shell/type-shell";
import { verificationCopy } from "../../trust/verification-workspace-copy";
import { adminStatusLabel, adminStatusTone } from "../admin-status-labels";
import { verificationApplicationsCopy } from "../verification-applications-copy";
import { VerificationModerationControls } from "../verification-controls";

type AdminCopy = ReturnType<typeof getDictionary>["admin"];

type VerificationRequest = {
  id: string;
  targetType: string;
  targetId: string;
  requesterId: string;
  createdAt: Date | string;
  notes?: string | null;
  evidenceUpdated?: boolean;
  targetUsername?: string | null;
  organizationSlug?: string | null;
  currentSpecialties?: string[] | null;
  currentGithubUrl?: string | null;
  serverName?: string | null;
  serverSlug?: string | null;
  claimScope?: "personal" | "organization" | null;
  proofMatchesServer?: boolean | null;
  proofUrl?: string | null;
  reviewNotes?: string | null;
  resolvedAt?: Date | string | null;
  status: string;
  applicationRevision: string;
};

export function AdminVerificationQueueSection({
  locale,
  copy,
  dateLocale,
  verificationView,
  verificationPage,
  pendingVerificationCount,
  verificationRequests,
  moreVerifications,
  verificationHref,
  focusedVerificationId = null,
}: {
  locale: Locale;
  copy: AdminCopy;
  dateLocale: string;
  verificationView: "pending" | "history";
  verificationPage: number;
  pendingVerificationCount: number;
  verificationRequests: VerificationRequest[];
  moreVerifications: boolean;
  verificationHref: (view: "pending" | "history", page: number) => string;
  focusedVerificationId?: string | null;
}) {
  return (
    <section>
      <SectionHeader
        title={copy.verificationQueue}
        description={`${pendingVerificationCount} ${copy.pendingRequests}`}
        action={<BadgeCheck className={typeIconAccent} />}
      />
      <nav aria-label={copy.verificationQueue} className="mb-3 flex gap-2">
        <Link
          href={verificationHref("pending", 1)}
          aria-current={verificationView === "pending" ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${verificationView === "pending" ? "bg-accent-soft text-accent" : "text-muted"}`}
        >
          {copy.verificationPending} ({pendingVerificationCount})
        </Link>
        <Link
          href={verificationHref("history", 1)}
          aria-current={verificationView === "history" ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] ${verificationView === "history" ? "bg-accent-soft text-accent" : "text-muted"}`}
        >
          {copy.verificationHistory}
        </Link>
      </nav>
      <div className="space-y-2.5">
        {verificationRequests.length > 0 ? (
          verificationRequests.map((request) => (
            <div
              key={request.id}
              id={`verification-${request.id}`}
              data-verification-focus={focusedVerificationId === request.id ? "true" : undefined}
              className={`nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center${
                focusedVerificationId === request.id
                  ? " ring-2 ring-[color:var(--nexus-accent)] ring-offset-2 ring-offset-[var(--nexus-page)]"
                  : ""
              }`}
            >
              <div className={typeMinSpace1}>
                <div className={typeFlexWrapCenterGap2}>
                  <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                    {request.targetType}
                  </span>
                  {request.serverName ? (
                    <span className="min-w-0 break-words text-sm font-semibold text-primary">
                      {request.serverName}
                    </span>
                  ) : null}
                  <span className="truncate font-code text-xs font-heading text-muted">
                    {request.targetId}
                  </span>
                </div>
                <p className={typeCaptionMuted}>
                  {copy.requester} {request.requesterId} •{" "}
                  {new Date(request.createdAt).toLocaleDateString(dateLocale)}
                </p>
                {request.notes && <p className={typeCaptionFaint}>{request.notes}</p>}
                {request.evidenceUpdated && (
                  <p className={typeXsSecondary}>{verificationApplicationsCopy(locale).updated}</p>
                )}
                {request.claimScope === "personal" ? (
                  <p className={typeXsSecondary}>{copy.verificationClaimPersonal}</p>
                ) : null}
                {request.claimScope === "organization" ? (
                  <p className={typeXsSecondary}>{copy.verificationClaimOrganization}</p>
                ) : null}
                {request.proofMatchesServer === true ? (
                  <p className={typeXsSecondary}>{copy.verificationProofCurrent}</p>
                ) : null}
                {request.proofMatchesServer === false ? (
                  <ErrorState
                    id="admin-verification-proof-stale"
                    title={copy.verificationProofStale}
                    description={copy.verificationProofStaleHint}
                  />
                ) : null}
                {request.serverSlug ? (
                  <Link
                    href={`/servers/${encodeURIComponent(request.serverSlug)}`}
                    className={linkAccentXsBlock}
                  >
                    {copy.verificationOpenServer}
                  </Link>
                ) : null}
                {request.targetType === "server" ? (
                  <Link
                    href={`/workspace/servers/${encodeURIComponent(request.targetId)}`}
                    className={linkAccentXsBlock}
                  >
                    {copy.verificationManagedServer}
                  </Link>
                ) : null}
                {request.targetUsername && (
                  <Link
                    href={`/users/${encodeURIComponent(request.targetUsername)}`}
                    className={linkAccentXsBlock}
                  >
                    {verificationCopy(locale).publicProfile} · @{request.targetUsername}
                  </Link>
                )}
                {request.organizationSlug && (
                  <Link
                    href={`/organizations/${encodeURIComponent(request.organizationSlug)}`}
                    className={linkAccentXsBlock}
                  >
                    {verificationCopy(locale).organization}
                  </Link>
                )}
                {request.currentSpecialties && request.currentSpecialties.length > 0 && (
                  <p className="break-words text-xs text-secondary">
                    {request.currentSpecialties.slice(0, 12).join(" · ")}
                  </p>
                )}
                {safeExternalWebUrl(request.currentGithubUrl) && (
                  <a
                    href={safeExternalWebUrl(request.currentGithubUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkAccentXsBlock}
                  >
                    {verificationCopy(locale).github}
                  </a>
                )}
                {safeExternalWebUrl(request.proofUrl) && (
                  <a
                    href={safeExternalWebUrl(request.proofUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all font-caption text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {copy.verificationProof}
                  </a>
                )}
                {request.reviewNotes && (
                  <p className="font-code font-caption text-faint">
                    {copy.review}: {request.reviewNotes}
                  </p>
                )}
                {request.resolvedAt && (
                  <p className={typeCaptionFaint}>
                    {copy.reportDecidedAt}:{" "}
                    {new Date(request.resolvedAt).toLocaleString(dateLocale)}
                  </p>
                )}
              </div>

              <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
                <StatusBadge
                  status={adminStatusLabel(locale, request.status)}
                  tone={adminStatusTone(request.status)}
                />
                {request.status === "pending" && (
                  <VerificationModerationControls
                    key={`${request.id}:${request.applicationRevision}`}
                    requestId={request.id}
                    applicationRevision={request.applicationRevision}
                  />
                )}
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            title={
              verificationView === "pending"
                ? copy.noVerificationRequests
                : copy.noVerificationHistory
            }
            description={copy.description}
            icon={<BadgeCheck className="h-6 w-6" aria-hidden="true" />}
          />
        )}
      </div>
      {(verificationPage > 1 || moreVerifications) && (
        <nav aria-label={copy.verificationPages} className={typeMt3FlexCenterGap3Xs}>
          {verificationPage > 1 && (
            <Link
              className={linkAccentTight}
              href={verificationHref(verificationView, verificationPage - 1)}
            >
              {copy.previous}
            </Link>
          )}
          <span className="text-muted">
            {copy.reportPage} {verificationPage}
          </span>
          {moreVerifications && verificationPage < 99_999 && (
            <Link
              className={linkAccentTight}
              href={verificationHref(verificationView, verificationPage + 1)}
            >
              {copy.next}
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
