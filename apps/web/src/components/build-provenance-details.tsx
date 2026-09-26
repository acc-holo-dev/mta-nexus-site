import type { Build } from "@nexus/domain";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { getBuildProvenance } from "../lib/build-provenance";
import { getDictionary, type Locale } from "../lib/i18n";

const toneClass = {
  positive:
    "border-[color:var(--nexus-success)]/20 bg-success-soft text-success",
  neutral: "border-base bg-inset text-secondary",
  warning:
    "border-[color:var(--nexus-warning)]/20 bg-warning-soft text-warning",
  danger:
    "border-[color:var(--nexus-danger)]/20 bg-danger-soft text-danger",
} as const;

export function BuildProvenanceDetails({
  build,
  locale = "en",
}: {
  build: Pick<
    Build,
    | "status"
    | "sha256Hash"
    | "fileName"
    | "mimeType"
    | "scanStatus"
    | "scanner"
    | "scannedAt"
    | "mtaVersionTarget"
    | "isSigned"
  >;
  locale?: Locale;
}) {
  const copy = getDictionary(locale).provenance;
  const provenance = getBuildProvenance(build);

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
    : provenance.scanStatus === "clean" ||
        provenance.scanStatus === "malicious"
      ? copy.scannerIdentityMissing
      : provenance.scanStatus === "error"
        ? copy.noSuccessfulVerdict
        : copy.noCleanVerdict;

  return (
    <details className="rounded-lg border border-base bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-semibold text-secondary">
        <span className="flex items-center gap-2">
          <Fingerprint className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {copy.title}
        </span>
        <span className="font-mono text-faint">SHA-256</span>
      </summary>

      <div className="space-y-3 border-t border-base px-3 py-3 text-[11px]">
        <div
          className={`rounded-md border px-2.5 py-2 ${
            toneClass[provenance.scanTone]
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{scanLabel}</span>
          </div>
          <div className="mt-1 opacity-80">{scanDetail}</div>
        </div>

        <dl className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-faint">SHA-256</dt>
          <dd>
            <code className="block select-all break-all rounded border border-base bg-inset px-2 py-1.5 font-mono text-[10px] leading-relaxed text-secondary">
              {build.sha256Hash}
            </code>
          </dd>

          <dt className="text-faint">{copy.scanTime}</dt>
          <dd className="font-mono text-secondary">
            {provenance.scannedAtLabel || copy.notRecorded}
          </dd>

          <dt className="text-faint">{copy.artifactFile}</dt>
          <dd className="break-all text-secondary">{build.fileName}</dd>

          <dt className="text-faint">{copy.mimeType}</dt>
          <dd className="font-mono text-secondary">{build.mimeType}</dd>

          <dt className="text-faint">{copy.mtaTarget}</dt>
          <dd className="font-mono text-secondary">
            {build.mtaVersionTarget
              ? `>= ${build.mtaVersionTarget}`
              : copy.notDeclared}
          </dd>

          <dt className="text-faint">{copy.signature}</dt>
          <dd className="text-secondary">
            {build.isSigned ? copy.recordedAsSigned : copy.notAvailable}
          </dd>

          <dt className="text-faint">{copy.publicationState}</dt>
          <dd className="text-secondary">
            {build.status.replace(/_/g, " ")}
          </dd>
        </dl>

        <p className="text-[10px] leading-relaxed text-faint">
          {copy.explanation}
        </p>
      </div>
    </details>
  );
}
