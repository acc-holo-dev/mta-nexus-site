import { EmptyState, ErrorState, SectionHeader, StatusBadge } from "@nexus/ui";
import { PackageCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type { getDictionary, Locale } from "../../../lib/i18n";
import { BuildQuarantineControls } from "../../resources/quarantine-controls";
import { linkAccent } from "../../shell/link-shell";
import { panelFlexBetweenP4 } from "../../shell/panel-shell";
import {
  typeCaptionFaint,
  typeCaptionMuted,
  typeCaptionSecondary,
  typeFlexCenterGap2,
  typeFlexWFullColStartGap3Md,
  typeFlexWrapCenterGap2,
  typeIcon4Warning,
  typeMinSpace1,
  typeMt3FlexCenterGap3Xs,
  typeWarningSoftBadge,
} from "../../shell/type-shell";
import { adminStatusLabel, adminStatusTone } from "../admin-status-labels";
import { storageMaintenanceCopy } from "../storage-maintenance-i18n";

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
  const hashLabel = storageMaintenanceCopy(locale).hash;
  return (
    <>
      <section>
        <SectionHeader
          title={copy.resourceBuildQueue}
          description={`${pendingBuildCount} ${copy.buildsAwaitingReview}`}
          action={<PackageCheck className={typeIcon4Warning} />}
        />
        <div className="space-y-2.5">
          {pendingBuilds.length > 0 ? (
            pendingBuilds.map((build) => (
              <div key={build.id} className={panelFlexBetweenP4}>
                <div className={typeMinSpace1}>
                  <div className={typeFlexCenterGap2}>
                    <span className={typeWarningSoftBadge}>{copy.pendingReview}</span>
                    <span className="truncate font-code text-xs font-heading text-primary">
                      {build.fileName} · v{build.version}
                    </span>
                  </div>
                  <p className={typeCaptionMuted}>
                    {copy.resource} {build.productId} •{" "}
                    {(build.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <p className={typeCaptionSecondary}>
                    {build.productStatus === "published" ? (
                      <Link
                        className={linkAccent}
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
                  <p className={typeCaptionMuted}>
                    {copy.resourcePublisher}:{" "}
                    <Link
                      className={linkAccent}
                      href={`/users/${encodeURIComponent(build.publisherUsername)}`}
                    >
                      @{build.publisherUsername}
                    </Link>
                  </p>
                  <p className={typeCaptionFaint}>
                    {copy.scan}: {adminStatusLabel(locale, build.scanStatus)} · {hashLabel}
                  </p>
                  <code className="block break-all font-code text-[10px] text-faint">
                    {build.sha256Hash}
                  </code>
                  {build.scanner && build.scannedAt && (
                    <p className={typeCaptionFaint}>
                      {copy.scanProvenance}: {build.scanner} ·{" "}
                      {new Date(build.scannedAt).toLocaleString(dateLocale)}
                    </p>
                  )}
                  {build.releaseNotes && <p className={typeCaptionFaint}>{build.releaseNotes}</p>}
                </div>
                <div className={typeFlexWFullColStartGap3Md}>
                  <StatusBadge
                    status={adminStatusLabel(locale, build.scanStatus)}
                    tone={adminStatusTone(build.scanStatus)}
                  />
                  <Link
                    href={`/admin/resources/${build.productId}/builds/${build.id}`}
                    className={`${linkAccent} text-xs`}
                  >
                    {copy.versionDecisionHistory}
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
          <nav aria-label={copy.buildPages} className={typeMt3FlexCenterGap3Xs}>
            {buildPage > 1 && (
              <Link className={linkAccent} href={adminHref({ buildPage: buildPage - 1 })}>
                {copy.previous}
              </Link>
            )}
            <span className="text-muted">
              {copy.reportPage} {buildPage}
            </span>
            {moreBuilds && buildPage < 99_999 && (
              <Link className={linkAccent} href={adminHref({ buildPage: buildPage + 1 })}>
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
              <div key={build.id} className={panelFlexBetweenP4}>
                <div className={typeMinSpace1}>
                  <div className={typeFlexWrapCenterGap2}>
                    <StatusBadge
                      status={adminStatusLabel(locale, build.status)}
                      tone={adminStatusTone(build.status)}
                    />
                    <span className="truncate font-code text-xs font-heading text-primary">
                      {build.fileName} · v{build.version}
                    </span>
                  </div>
                  <p className={typeCaptionSecondary}>
                    {build.productStatus === "published" ? (
                      <Link
                        className={linkAccent}
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
                  <p className={typeCaptionMuted}>
                    {copy.resourcePublisher}:{" "}
                    <Link
                      className={linkAccent}
                      href={`/users/${encodeURIComponent(build.publisherUsername)}`}
                    >
                      @{build.publisherUsername}
                    </Link>
                  </p>
                  <p className={typeCaptionFaint}>
                    {copy.scan}: {adminStatusLabel(locale, build.scanStatus)} · {hashLabel}
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
                        <p className={typeCaptionFaint}>
                          {copy.quarantinedAt}:{" "}
                          {new Date(build.quarantinedAt).toLocaleString(dateLocale)}
                        </p>
                      )}
                    </>
                  )}
                  {build.scanStatus === "clean" && build.scanner?.trim() && build.scannedAt && (
                    <a
                      href={`/api/admin/builds/${encodeURIComponent(build.id)}/download`}
                      className={`${linkAccent} text-xs font-semibold`}
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
          <nav aria-label={copy.quarantinePages} className={typeMt3FlexCenterGap3Xs}>
            {riskBuildPage > 1 && (
              <Link className={linkAccent} href={adminHref({ riskBuildPage: riskBuildPage - 1 })}>
                {copy.previous}
              </Link>
            )}
            <span className="text-muted">
              {copy.reportPage} {riskBuildPage}
            </span>
            {moreRiskBuilds && riskBuildPage < 99_999 && (
              <Link className={linkAccent} href={adminHref({ riskBuildPage: riskBuildPage + 1 })}>
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
