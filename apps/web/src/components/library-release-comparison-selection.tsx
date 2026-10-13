"use client";
import { useRef, useState } from "react";
import { libraryReleaseComparisonCopy } from "../lib/library-release-comparison-i18n";
import { getResourceReleaseControlCopy } from "../lib/resource-release-control-i18n";
import { LibraryReleaseCommandStatus, useLibraryReleaseCommand } from "./library-release-command";
export function LibraryReleaseComparisonSelection({
  productId,
  locale,
  selection,
  target,
}: {
  productId: string;
  locale: string;
  selection: { revision: number; mode: "latest" | "fixed"; buildId: string | null };
  target: { id: string; version: string; sha256Hash: string; fileSizeBytes: number };
}) {
  const copy = libraryReleaseComparisonCopy(locale);
  const control = getResourceReleaseControlCopy(locale);
  const state = useLibraryReleaseCommand(productId, locale);
  const reviewSelection = { ...selection }, artifact = { ...target };
  const fingerprint = JSON.stringify([productId, reviewSelection.revision, reviewSelection.mode, reviewSelection.buildId,
    artifact.id, artifact.version, artifact.sha256Hash, artifact.fileSizeBytes]);
  const current = useRef(fingerprint);
  current.current = fingerprint;
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const confirmed = acknowledged === fingerprint;
  const selected = selection.mode === "fixed" && selection.buildId === target.id;
  const disabled = state.busy || state.saved || state.pending !== null || selected;
  function apply() {
    if (!confirmed || disabled || current.current !== fingerprint) return;
    void state.send({
      mode: "fixed",
      buildId: artifact.id,
      expectedRevision: reviewSelection.revision,
      reviewedArtifact: { sha256Hash: artifact.sha256Hash, fileSizeBytes: artifact.fileSizeBytes },
    });
  }
  return (
    <section className="nexus-panel space-y-4 p-5" aria-label={copy.chooseCompared}>
      <h2>
        {copy.chooseCompared}: {target.version}
      </h2>
      <p className="text-sm text-secondary">{control.selectNote}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt>{control.revision}</dt>
        <dd>{selection.revision}</dd>
        <dt>{copy.hash}</dt>
        <dd className="break-all">{target.sha256Hash}</dd>
        <dt>{copy.size}</dt>
        <dd>{target.fileSizeBytes}</dd>
      </dl>
      {selected ? (
        <p role="status">{copy.alreadySelected}</p>
      ) : (
        <>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={disabled}
              onChange={(event) => {
                if (current.current === fingerprint) setAcknowledged(event.target.checked ? fingerprint : null);
              }}
            />
            <span>{copy.confirmChoice}</span>
          </label>
          <button
            type="button"
            disabled={disabled || !confirmed}
            onClick={apply}
            className="rounded-md border border-base px-4 py-2 text-sm"
          >
            {state.busy ? control.saving : copy.chooseCompared}
          </button>
        </>
      )}
      <LibraryReleaseCommandStatus state={state} locale={locale} />
    </section>
  );
}
