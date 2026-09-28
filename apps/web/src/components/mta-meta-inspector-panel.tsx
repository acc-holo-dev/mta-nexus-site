"use client";

import { FileSearch, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useNexusLocale } from "./locale-context";
import { getMtaVersionTargetSuggestion } from "../lib/mta-version-target";

type InspectionResponse = {
  inspection?: {
    byteLength: number;
    info: Record<string, string> | null;
    dependencyResources: string[];
    minMtaVersion: {
      client: string | null;
      server: string | null;
      both: string | null;
    } | null;
    summary: {
      scriptCount: number;
      clientScripts: number;
      serverScripts: number;
      sharedScripts: number;
      fileCount: number;
      mapCount: number;
      dependencyCount: number;
      exportCount: number;
      httpExportCount: number;
      aclRightCount: number;
      validationDisabledScripts: number;
    };
    issues: Array<{
      code: string;
      severity: "warning" | "error";
      message: string;
    }>;
  };
  securityVerdict?: null;
  note?: string;
  error?: string;
  code?: string;
};

const MAX_META_BYTES = 256 * 1024;

export function MtaMetaInspectorPanel({
  onApplyMinimumVersion,
  minimumVersionLocked = false,
}: {
  onApplyMinimumVersion: (version: string) => void;
  minimumVersionLocked?: boolean;
}) {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.metaInspector;
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<InspectionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  function responseError(data: InspectionResponse | null): string {
    if (data?.code === "META_TOO_LARGE") return copy.tooLarge;
    if (data?.code === "META_FORBIDDEN_XML_FEATURE") {
      return copy.forbiddenXml;
    }
    return copy.unavailable;
  }

  async function inspect() {
    if (!file || loading) return;

    setLoading(true);
    setResult(null);

    try {
      if (file.size > MAX_META_BYTES) {
        setResult({ error: copy.tooLarge });
        return;
      }

      const source = await file.text();
      const response = await fetch("/api/resources/inspect-meta", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: source,
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await response.json().catch(() => null)) as
        | InspectionResponse
        | null;

      if (!response.ok || !data) {
        setResult({ error: responseError(data) });
        return;
      }

      setResult(data);
    } catch {
      setResult({ error: copy.unavailable });
    } finally {
      setLoading(false);
    }
  }

  const inspection = result?.inspection;
  const versionSuggestion = getMtaVersionTargetSuggestion(
    inspection?.minMtaVersion ?? null,
  );
  const localizedVersionIssues: Record<string, string> = {
    MTA_VERSION_MULTIPLE: copy.multipleMinimumVersions,
    MTA_VERSION_MISSING: copy.minimumVersionMissing,
    MTA_VERSION_INVALID: copy.minimumVersionInvalid,
    MTA_VERSION_TARGET_CONFLICT: copy.minimumVersionConflict,
  };

  return (
    <section
      className="nexus-panel space-y-4 p-5"
      aria-labelledby="meta-inspector-heading"
    >
      <div className="flex items-start gap-3">
        <FileSearch
          className="mt-0.5 h-5 w-5 text-accent"
          aria-hidden="true"
        />
        <div>
          <h2
            id="meta-inspector-heading"
            className="text-sm font-bold text-primary"
          >
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {copy.description}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="text-xs text-secondary">{copy.fileLabel}</span>
          <input
            type="file"
            accept=".xml,text/xml,text/plain"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
          />
        </label>

        <button
          type="button"
          disabled={!file || loading}
          onClick={() => void inspect()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] disabled:opacity-50"
        >
          {loading && (
            <LoaderCircle
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          )}
          {loading ? copy.inspecting : copy.inspect}
        </button>
      </div>

      {result?.error && (
        <p
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-warning)]/20 bg-warning-soft p-3 text-xs text-warning"
        >
          {result.error}
        </p>
      )}

      {inspection && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-base bg-inset p-3">
              <div className="font-label uppercase text-faint">
                {copy.scripts}
              </div>
              <div className="mt-1 text-lg font-black text-primary">
                {inspection.summary.scriptCount}
              </div>
              <div className="text-[10px] text-faint">
                {inspection.summary.serverScripts} {copy.server} ·{" "}
                {inspection.summary.clientScripts} {copy.client} ·{" "}
                {inspection.summary.sharedScripts} {copy.shared}
              </div>
            </div>

            <div className="rounded-lg border border-base bg-inset p-3">
              <div className="font-label uppercase text-faint">
                {copy.files}
              </div>
              <div className="mt-1 text-lg font-black text-primary">
                {inspection.summary.fileCount}
              </div>
            </div>

            <div className="rounded-lg border border-base bg-inset p-3">
              <div className="font-label uppercase text-faint">
                {copy.dependencies}
              </div>
              <div className="mt-1 text-lg font-black text-primary">
                {inspection.summary.dependencyCount}
              </div>
            </div>

            <div className="rounded-lg border border-base bg-inset p-3">
              <div className="font-label uppercase text-faint">
                {copy.exports}
              </div>
              <div className="mt-1 text-lg font-black text-primary">
                {inspection.summary.exportCount}
              </div>
              {inspection.summary.httpExportCount > 0 && (
                <div className="text-[10px] text-warning">
                  {inspection.summary.httpExportCount} {copy.httpEnabled}
                </div>
              )}
            </div>
          </div>

          {(inspection.info?.name ||
            inspection.info?.author ||
            inspection.minMtaVersion) && (
            <dl className="grid gap-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]">
              {inspection.info?.name && (
                <>
                  <dt className="text-faint">{copy.resourceName}</dt>
                  <dd className="text-secondary">
                    {inspection.info.name}
                  </dd>
                </>
              )}
              {inspection.info?.author && (
                <>
                  <dt className="text-faint">{copy.declaredAuthor}</dt>
                  <dd className="text-secondary">
                    {inspection.info.author}
                  </dd>
                </>
              )}
              {inspection.minMtaVersion && (
                <>
                  <dt className="text-faint">{copy.minimumMta}</dt>
                  <dd className="font-mono text-secondary">
                    {inspection.minMtaVersion.both ||
                      [
                        inspection.minMtaVersion.server &&
                          `${copy.server} ${inspection.minMtaVersion.server}`,
                        inspection.minMtaVersion.client &&
                          `${copy.client} ${inspection.minMtaVersion.client}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                      copy.notDeclared}
                  </dd>
                </>
              )}
              {versionSuggestion && (
                <>
                  <dt className="text-faint">{copy.formTarget}</dt>
                  <dd className="flex flex-wrap items-center gap-2 text-secondary">
                    <code>{versionSuggestion}</code>
                    <button
                      type="button"
                      disabled={minimumVersionLocked}
                      onClick={() => onApplyMinimumVersion(versionSuggestion)}
                      className="min-h-8 rounded-md border border-base px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copy.applyMinimumVersion}
                    </button>
                  </dd>
                </>
              )}
            </dl>
          )}

          {inspection.dependencyResources.length > 0 && (
            <div>
              <div className="font-label uppercase text-faint">
                {copy.includedResources}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inspection.dependencyResources.map((dependency) => (
                  <span
                    key={dependency}
                    className="rounded border border-base bg-inset px-2 py-1 font-mono text-[10px] text-secondary"
                  >
                    {dependency}
                  </span>
                ))}
              </div>
            </div>
          )}

          {inspection.issues.length > 0 && (
            <div className="space-y-2">
              <div className="font-label uppercase text-faint">
                {copy.structuralNotes}
              </div>
              <ul className="space-y-1.5">
                {inspection.issues.map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className={
                      issue.severity === "error"
                        ? "text-xs text-danger"
                        : "text-xs text-warning"
                    }
                  >
                    {localizedVersionIssues[issue.code] ?? issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-faint">
            {copy.note}
          </p>
        </div>
      )}
    </section>
  );
}
