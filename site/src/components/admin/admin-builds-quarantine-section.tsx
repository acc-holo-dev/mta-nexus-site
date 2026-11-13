import { EmptyState, ErrorState, SectionHeader, StatusBadge } from "@nexus/ui";
import { PackageCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { adminStatusLabel, adminStatusTone } from "../../app/admin/status-labels";
import type { getDictionary, Locale } from "../../lib/i18n";
import { BuildQuarantineControls } from "../build-quarantine-controls";

const touchLinkClass =
  "inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

type AdminCopy = ReturnType<typeof getDictionary>["admin"];

type PendingBuild = {
  id: string;
  fileName: string;
  version: string;
  productId: string;
  fileSizeBytes: number;
  productStatus: string;
  productSlug: string;
  productTitle: string;
  publisherUsername: string;
  scanStatus: string;
  sha256Hash: string;
  scanner?: string | null;
  scannedAt?: Date | string | null;
  releaseNotes?: string | null;
};

type RiskBuild = {
  id: string;
  fileName: string;
  version: string;
  status: string;
  productStatus: string;
  productSlug: string;
  productTitle: string;
  publisherUsername: string;
  scanStatus: string;
  sha256Hash: string;
  quarantineReason?: string | null;
  quarantinedAt?: Date | string | null;
  scanner?: string | null;
  scannedAt?: Date | string | null;
};

export function AdminBuildsQuarantineSection({
  locale,
  copy,
  dateLocale,
  buildPage,
  pendingBuildCount,
  pendingBuilds,
  moreBuilds,
  riskBuildPage,
  quarantinedBuildCount,
  riskBuilds,
  moreRiskBuilds,
  adminHref,
}: {
  locale: Locale;
  copy: AdminCopy;
  dateLocale: string;
  buildPage: number;
  pendingBuildCount: number;
  pendingBuilds: PendingBuild[];
  moreBuilds: boolean;
  riskBuildPage: number;
  quarantinedBuildCount: number;
  riskBuilds: RiskBuild[];
  moreRiskBuilds: boolean;
  adminHref: (changes: Record<string, string | number>) => string;
}) {
  return (
    <>
      <section>
        <SectionHeader
          title={copy.resourceBuildQueue}
          description={`${pendingBuildCount} ${copy.buildsAwaitingReview}`}
          action={<PackageCheck className="h-4 w-4 text-warning" />}
        />
        <div className="space-y-2.5">
          {pendingBuilds.length > 0 ? (
            pendingBuilds.map((build) => (
              <div
                key={build.id}
                className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase text-warning">
                      {copy.pendingReview}
                    </span>
                    <span className="truncate font-code text-xs font-heading text-primary">
                      {build.fileName} · v{build.version}
                    </span>
                  </div>
                  <p className="font-caption text-muted">
                    {copy.resource} {build.productId} •{" "}
                    {(build.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <p className="font-caption text-secondary">
                    {build.productStatus === "published" ? (
                      <Link
                        className={touchLinkClass}
                        href={`/market/${encodeURIComponent(build.productSlug)}`}
                      >
                        {build.productTitle}
                      </Link>
                    ) : (
                      <>
                        {build.productTitle} · {copy.resourceNotPublished}
                      </>
                    )}
                  </p>
                  <p className="font-caption text-muted">
                    {copy.resourcePublisher}:{" "}
                    <Link
                      className={touchLinkClass}
                      href={`/users/${encodeURIComponent(build.publisherUsername)}`}
                    >
                      @{build.publisherUsername}
                    </Link>
                  </p>
                  <p className="font-caption text-faint">
                    {copy.scan}: {adminStatusLabel(locale, build.scanStatus)} · SHA-256
                  </p>
                  <code className="block break-all font-code text-[10px] text-faint">
                    {build.sha256Hash}
                  </code>
                  {build.scanner && build.scannedAt && (
                    <p className="font-caption text-faint">
                      {copy.scanProvenance}: {build.scanner} ·{" "}
                      {new Date(build.scannedAt).toLocaleString(dateLocale)}
                    </p>
                  )}
                  {build.releaseNotes && (
                    <p className="font-caption text-faint">{build.releaseNotes}</p>
                  )}
                </div>
                <div className="flex w-full flex-col items-start gap-3 md:w-auto md:items-end">
                  <StatusBadge
                    status={adminStatusLabel(locale, build.scanStatus)}
                    tone={adminStatusTone(build.scanStatus)}
                  />
                  <Link
                    href={`/admin/resources/${build.productId}/builds/${build.id}`}
                    className={`${touchLinkClass} text-xs`}
                  >
                    {locale === "ru" ? "Версия и история решений" : "Version and decision history"}
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={copy.noBuilds}
              description={`${copy.buildsAwaitingReview}.`}
              icon={<PackageCheck className="h-6 w-6" aria-hidden="true" />}
            />
          )}
        </div>
        {(buildPage > 1 || moreBuilds) && (
          <nav aria-label={copy.buildPages} className="mt-3 flex items-center gap-3 text-xs">
            {buildPage > 1 && (
              <Link className={touchLinkClass} href={adminHref({ buildPage: buildPage - 1 })}>
                {copy.previous}
              </Link>
            )}
            <span className="text-muted">
              {copy.reportPage} {buildPage}
            </span>
            {moreBuilds && buildPage < 99_999 && (
              <Link className={touchLinkClass} href={adminHref({ buildPage: buildPage + 1 })}>
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>

      <section>
        <SectionHeader
          title={copy.quarantineQueue}
          description={`${quarantinedBuildCount} ${copy.buildsQuarantined}`}
          action={<ShieldAlert className="h-4 w-4 text-danger" />}
        />
        <p className="mb-3 max-w-3xl font-caption text-muted">{copy.quarantineQueueDescription}</p>
        <div className="space-y-2.5">
          {riskBuilds.length > 0 ? (
            riskBuilds.map((build) => (
              <div
                key={build.id}
                className="nexus-panel flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      status={adminStatusLabel(locale, build.status)}
                      tone={adminStatusTone(build.status)}
                    />
                    <span className="truncate font-code text-xs font-heading text-primary">
                      {build.fileName} · v{build.version}
                    </span>
                  </div>
                  <p className="font-caption text-secondary">
                    {build.productStatus === "published" ? (
                      <Link
                        className={touchLinkClass}
                        href={`/market/${encodeURIComponent(build.productSlug)}`}
                      >
                        {build.productTitle}
                      </Link>
                    ) : (
                      <>
                        {build.productTitle} · {copy.resourceNotPublished}
                      </>
                    )}
                  </p>
                  <p className="font-caption text-muted">
                    {copy.resourcePublisher}:{" "}
                    <Link
                      className={touchLinkClass}
                      href={`/users/${encodeURIComponent(build.publisherUsername)}`}
                    >
                      @{build.publisherUsername}
                    </Link>
                  </p>
                  <p className="font-caption text-faint">
                    {copy.scan}: {adminStatusLabel(locale, build.scanStatus)} · SHA-256
                  </p>
                  <code className="block break-all font-code text-[10px] text-faint">
                    {build.sha256Hash}
                  </code>
                  {build.status === "quarantined" && (
                    <>
                      <ErrorState
                        id="admin-build-quarantine-reason"
                        title={copy.quarantineReason}
                        description={build.quarantineReason ?? undefined}
                      />
                      {build.quarantinedAt && (
                        <p className="font-caption text-faint">
                          {copy.quarantinedAt}:{" "}
                          {new Date(build.quarantinedAt).toLocaleString(dateLocale)}
                        </p>
                      )}
                    </>
                  )}
                  {build.scanStatus === "clean" && build.scanner?.trim() && build.scannedAt && (
                    <a
                      href={`/api/admin/builds/${encodeURIComponent(build.id)}/download`}
                      className={`${touchLinkClass} text-xs font-semibold`}
                    >
                      {copy.reviewArtifact}
                    </a>
                  )}
                </div>
                <BuildQuarantineControls
                  buildId={build.id}
                  status={build.status as "published" | "quarantined"}
                />
              </div>
            ))
          ) : (
            <EmptyState
              title={copy.noRiskBuilds}
              description={copy.quarantineQueueDescription}
              icon={<ShieldAlert className="h-6 w-6" aria-hidden="true" />}
            />
          )}
        </div>
        {(riskBuildPage > 1 || moreRiskBuilds) && (
          <nav aria-label={copy.quarantinePages} className="mt-3 flex items-center gap-3 text-xs">
            {riskBuildPage > 1 && (
              <Link
                className={touchLinkClass}
                href={adminHref({ riskBuildPage: riskBuildPage - 1 })}
              >
                {copy.previous}
              </Link>
            )}
            <span className="text-muted">
              {copy.reportPage} {riskBuildPage}
            </span>
            {moreRiskBuilds && riskBuildPage < 99_999 && (
              <Link
                className={touchLinkClass}
                href={adminHref({ riskBuildPage: riskBuildPage + 1 })}
              >
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
