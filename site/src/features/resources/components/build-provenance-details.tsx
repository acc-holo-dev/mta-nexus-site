import { ErrorState } from "@nexus/ui";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import {
  typeBreakAllSecondary,
  typeFlexCenterGap2,
  typeIcon35,
  typeMonoSecondary,
  typeTenLeadingFaint,
} from "../../shell/type-shell";
import { getBuildProvenance } from "../model/build-provenance";

const toneClass = {
  positive: "border-[color:var(--nexus-success)]/20 bg-success-soft text-success",
  neutral: "border-base bg-inset text-secondary",
  warning: "border-[color:var(--nexus-warning)]/20 bg-warning-soft text-warning",
  danger: "border-[color:var(--nexus-danger)]/20 bg-danger-soft text-danger",
} as const;

type Dictionary = ReturnType<typeof getDictionary>;

/** Locale label for a build status. Unknown values stay raw; underscores are not rewritten. */
function publicationLabel(status: string, dictionary: Dictionary): string {
  const product = dictionary.product;
  switch (status) {
    case "draft":
      return product.buildDraft;
    case "testing":
      return product.buildTesting;
    case "pending_review":
      return product.buildPendingReview;
    case "published":
      return product.buildPublished;
    case "rejected":
      return product.buildRejected;
    case "deprecated":
      return product.buildDeprecated;
    case "retired":
      return product.buildRetired;
    case "quarantined":
      return dictionary.authorResources.buildLabels.quarantined;
    default:
      return status;
  }
}

/** Accepts domain Builds and public/library projections (nullables from SQL). */
export type BuildProvenanceDetailsBuild = {
  status: string;
  sha256Hash: string;
  fileName: string;
  scanStatus: string;
  scanner?: string | null;
  scannedAt?: Date | null;
  mtaVersionTarget?: string | null;
  isSigned: boolean;
  id?: string;
  version?: string;
  mimeType?: string | null;
  fileSizeBytes?: number;
};

export function BuildProvenanceDetails({
  build,
  locale = "en",
}: {
  build: BuildProvenanceDetailsBuild;
  locale?: Locale;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.provenance;
  const provenance = getBuildProvenance(build);
  const numberLocale = locale === "ru" ? "ru-RU" : "en-US";
  const publicationState = publicationLabel(build.status, dictionary);

  const scanLabel =
    provenance.scanStatus === "clean"
      ? copy.cleanScanRecorded
      : provenance.scanStatus === "malicious"
        ? copy.blockedMalicious
        : provenance.scanStatus === "error"
          ? copy.scannerUnavailable
          : copy.scanNotRecorded;

  const scanDetail = provenance.scanner
    ? `${copy.scanner}: ${provenance.scanner}`
    : provenance.scanStatus === "clean" || provenance.scanStatus === "malicious"
      ? copy.scannerIdentityMissing
      : provenance.scanStatus === "error"
        ? copy.noSuccessfulVerdict
        : copy.noCleanVerdict;

  return (
    <details
      data-testid="build-provenance"
      data-build-id={build.id}
      className="rounded-lg border border-base bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-semibold text-secondary">
        <span className={typeFlexCenterGap2}>
          <Fingerprint className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {copy.title}
        </span>
        <span className="font-mono text-faint">{copy.hash}</span>
      </summary>

      <div className="space-y-3 border-t border-base px-3 py-3 text-[11px]">
        {provenance.scanStatus === "clean" ? (
          <div className={`rounded-md border px-2.5 py-2 ${toneClass.positive}`}>
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className={typeIcon35} aria-hidden="true" />
              <span>{scanLabel}</span>
            </div>
            <div className="mt-1 opacity-80">{scanDetail}</div>
            <div className="mt-2 font-semibold">
              {copy.trustedCleanGate}:{" "}
              {provenance.trustedCleanScan ? copy.trustedCleanMet : copy.trustedCleanMissing}
            </div>
          </div>
        ) : (
          <ErrorState
            id={
              provenance.scanStatus === "malicious"
                ? "build-provenance-scan-blocked"
                : provenance.scanStatus === "error"
                  ? "build-provenance-scanner-unavailable"
                  : "build-provenance-scan-not-recorded"
            }
            title={scanLabel}
            description={`${scanDetail}. ${copy.trustedCleanGate}: ${
              provenance.trustedCleanScan ? copy.trustedCleanMet : copy.trustedCleanMissing
            }`}
          />
        )}

        <dl className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
          {build.id ? (
            <>
              <dt className="text-faint">{copy.buildId}</dt>
              <dd>
                <code className="block select-all break-all rounded border border-base bg-inset px-2 py-1.5 font-mono text-[10px] leading-relaxed text-secondary">
                  {build.id}
                </code>
              </dd>
            </>
          ) : null}

          {build.version ? (
            <>
              <dt className="text-faint">{copy.version}</dt>
              <dd className={typeMonoSecondary}>{build.version}</dd>
            </>
          ) : null}

          <dt className="text-faint">{copy.hash}</dt>
          <dd>
            <code className="block select-all break-all rounded border border-base bg-inset px-2 py-1.5 font-mono text-[10px] leading-relaxed text-secondary">
              {build.sha256Hash}
            </code>
          </dd>

          <dt className="text-faint">{copy.scanTime}</dt>
          <dd className={typeMonoSecondary}>{provenance.scannedAtLabel || copy.notRecorded}</dd>

          <dt className="text-faint">{copy.artifactFile}</dt>
          <dd className={typeBreakAllSecondary}>{build.fileName}</dd>

          {typeof build.fileSizeBytes === "number" ? (
            <>
              <dt className="text-faint">{copy.fileSize}</dt>
              <dd className={typeMonoSecondary}>
                {build.fileSizeBytes.toLocaleString(numberLocale)} B
              </dd>
            </>
          ) : null}

          <dt className="text-faint">{copy.mimeType}</dt>
          <dd className={typeMonoSecondary}>{build.mimeType?.trim() || copy.notRecorded}</dd>

          <dt className="text-faint">{copy.mtaTarget}</dt>
          <dd className={typeMonoSecondary}>
            {build.mtaVersionTarget ? `>= ${build.mtaVersionTarget}` : copy.notDeclared}
          </dd>

          <dt className="text-faint">{copy.signature}</dt>
          <dd className="text-secondary">
            {build.isSigned ? copy.recordedAsSigned : copy.notAvailable}
          </dd>

          <dt className="text-faint">{copy.publicationState}</dt>
          <dd className="text-secondary">{publicationState}</dd>
        </dl>

        <p className={typeTenLeadingFaint}>{copy.explanation}</p>
      </div>
    </details>
  );
}
