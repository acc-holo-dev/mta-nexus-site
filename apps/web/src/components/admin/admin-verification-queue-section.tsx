import { EmptyState, SectionHeader, StatusBadge } from "@nexus/ui";
import { safeExternalWebUrl } from "@nexus/validation";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { adminStatusLabel, adminStatusTone } from "../../app/admin/status-labels";
import type { getDictionary, Locale } from "../../lib/i18n";
import { verificationApplicationsCopy } from "../../lib/verification-applications-copy";
import { verificationCopy } from "../../lib/verification-workspace-copy";
import { VerificationModerationControls } from "../verification-moderation-controls";

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
}) {
  return (
    <section>
      <SectionHeader
        title={copy.verificationQueue}
        description={`${pendingVerificationCount} ${copy.pendingRequests}`}
        action={<BadgeCheck className="h-4 w-4 text-accent" />}
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
              className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase text-accent">
                    {request.targetType}
                  </span>
                  <span className="truncate font-code text-xs font-heading text-primary">
                    {request.targetId}
                  </span>
                </div>
                <p className="font-caption text-muted">
                  {copy.requester} {request.requesterId} •{" "}
                  {new Date(request.createdAt).toLocaleDateString(dateLocale)}
                </p>
                {request.notes && <p className="font-caption text-faint">{request.notes}</p>}
                {request.evidenceUpdated && (
                  <p className="text-xs text-secondary">
                    {verificationApplicationsCopy(locale).updated}
                  </p>
                )}
                {request.targetUsername && (
                  <Link
                    href={`/users/${encodeURIComponent(request.targetUsername)}`}
                    className="block text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  >
                    {verificationCopy(locale).publicProfile} · @{request.targetUsername}
                  </Link>
                )}
                {request.organizationSlug && (
                  <Link
                    href={`/organizations/${encodeURIComponent(request.organizationSlug)}`}
                    className="block text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
                    className="block text-xs text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
                  <p className="font-caption text-faint">
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
        <nav aria-label={copy.verificationPages} className="mt-3 flex items-center gap-3 text-xs">
          {verificationPage > 1 && (
            <Link
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
              className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
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
