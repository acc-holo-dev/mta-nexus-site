import type { Build } from "@nexus/domain";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { getBuildProvenance } from "../lib/build-provenance";

const toneClass = {
  positive: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  neutral: "border-neutral-700 bg-neutral-900 text-neutral-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  danger: "border-red-500/20 bg-red-500/10 text-red-300",
} as const;

export function BuildProvenanceDetails({
  build,
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
}) {
  const provenance = getBuildProvenance(build);

  return (
    <details className="rounded-lg border border-neutral-800 bg-black/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-semibold text-neutral-300">
        <span className="flex items-center gap-2">
          <Fingerprint className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
          Artifact provenance
        </span>
        <span className="font-mono text-neutral-500">SHA-256</span>
      </summary>

      <div className="space-y-3 border-t border-neutral-800 px-3 py-3 text-[11px]">
        <div className={`rounded-md border px-2.5 py-2 ${toneClass[provenance.scanTone]}`}>
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{provenance.scanLabel}</span>
          </div>
          <div className="mt-1 opacity-80">{provenance.scanDetail}</div>
        </div>

        <dl className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-neutral-500">SHA-256</dt>
          <dd>
            <code className="block select-all break-all rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-[10px] leading-relaxed text-neutral-200">
              {build.sha256Hash}
            </code>
          </dd>

          <dt className="text-neutral-500">Scan time</dt>
          <dd className="font-mono text-neutral-300">
            {provenance.scannedAtLabel}
          </dd>

          <dt className="text-neutral-500">Artifact file</dt>
          <dd className="break-all text-neutral-300">{build.fileName}</dd>

          <dt className="text-neutral-500">MIME type</dt>
          <dd className="font-mono text-neutral-300">{build.mimeType}</dd>

          <dt className="text-neutral-500">MTA target</dt>
          <dd className="font-mono text-neutral-300">
            {build.mtaVersionTarget
              ? `>= ${build.mtaVersionTarget}`
              : "Not declared"}
          </dd>

          <dt className="text-neutral-500">Signature</dt>
          <dd className="text-neutral-300">
            {build.isSigned ? "Recorded as signed" : "Not available"}
          </dd>

          <dt className="text-neutral-500">Publication state</dt>
          <dd className="text-neutral-300">
            {build.status.replace(/_/g, " ")}
          </dd>
        </dl>

        <p className="text-[10px] leading-relaxed text-neutral-500">
          The SHA-256 identifies the stored artifact bytes. A clean malware
          scan is a separate recorded fact and is not a cryptographic
          signature. Download responses expose the same recorded hash through
          the X-Content-SHA256 header.
        </p>
      </div>
    </details>
  );
}
