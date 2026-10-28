"use client";

import { withOccurrenceKeys } from "@nexus/ui";
import { FileSearch, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useNexusLocale } from "./locale-context";
import { getMtaVersionTargetSuggestion } from "../lib/mta-version-target";
import { getMtaMetaInspectorIssueMessage } from "../lib/mta-meta-inspector-messages";

export type InspectionResponse = {
  inspection?: {
    byteLength: number;
    info: Record<string, string> | null;
    dependencyResources: string[];
    exports: Array<Record<string, string>>;
    aclRights: Array<Record<string, string>>;
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

export const metaInspectorClientPolicy = Object.freeze({
  maxBytes: 256 * 1024,
  previewEntries: 20,
  requestTimeoutMs: 10_000,
  fileAccept: ".xml,text/xml,text/plain",
});

export function metaInspectorPreview<T>(entries: readonly T[]): readonly T[] {
  return entries.slice(0, metaInspectorClientPolicy.previewEntries);
}

export async function requestMtaMetaInspection(
  source: string,
  fetcher: typeof fetch = fetch,
): Promise<{
  response: Response;
  data: InspectionResponse | null;
}> {
  const response = await fetcher("/api/resources/inspect-meta", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: source,
    signal: AbortSignal.timeout(metaInspectorClientPolicy.requestTimeoutMs),
  });
  const data = (await response.json().catch(() => null)) as InspectionResponse | null;
  return { response, data };
}

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
      if (file.size > metaInspectorClientPolicy.maxBytes) {
        setResult({ error: copy.tooLarge });
        return;
      }

      const source = await file.text();
      const { response, data } = await requestMtaMetaInspection(source);

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
  const versionSuggestion = getMtaVersionTargetSuggestion(inspection?.minMtaVersion ?? null);

  return (
    <section className="nexus-panel space-y-4 p-5" aria-labelledby="meta-inspector-heading">
      <div className="flex items-start gap-3">
        <FileSearch className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
        <div>
          <h2 id="meta-inspector-heading" className="text-sm font-bold text-primary">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{copy.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="text-xs text-secondary">{copy.fileLabel}</span>
          <input
            type="file"
            accept={metaInspectorClientPolicy.fileAccept}
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
          {loading && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
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
              <div className="font-label uppercase text-faint">{copy.scripts}</div>
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
              <div className="font-label uppercase text-faint">{copy.files}</div>
              <div className="mt-1 text-lg font-black text-primary">
                {inspection.summary.fileCount}
              </div>
            </div>

            <div className="rounded-lg border border-base bg-inset p-3">
              <div className="font-label uppercase text-faint">{copy.dependencies}</div>
              <div className="mt-1 text-lg font-black text-primary">
                {inspection.summary.dependencyCount}
              </div>
            </div>

            <div className="rounded-lg border border-base bg-inset p-3">
              <div className="font-label uppercase text-faint">{copy.exports}</div>
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

          {(inspection.info?.name || inspection.info?.author || inspection.minMtaVersion) && (
            <dl className="grid gap-2 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]">
              {inspection.info?.name && (
                <>
                  <dt className="text-faint">{copy.resourceName}</dt>
                  <dd className="text-secondary">{inspection.info.name}</dd>
                </>
              )}
              {inspection.info?.author && (
                <>
                  <dt className="text-faint">{copy.declaredAuthor}</dt>
                  <dd className="text-secondary">{inspection.info.author}</dd>
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
              <div className="font-label uppercase text-faint">{copy.includedResources}</div>
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

          {inspection.aclRights.length > 0 && (
            <section aria-labelledby="meta-inspector-acl-heading" className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="meta-inspector-acl-heading" className="font-label uppercase text-faint">
                  {copy.aclRights}
                </h3>
                <span className="text-[10px] text-faint">
                  {copy.aclRightsCount
                    .replace(
                      "{shown}",
                      String(
                        Math.min(
                          inspection.aclRights.length,
                          metaInspectorClientPolicy.previewEntries,
                        ),
                      ),
                    )
                    .replace("{total}", String(inspection.aclRights.length))}
                </span>
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {withOccurrenceKeys(metaInspectorPreview(inspection.aclRights), (right) =>
                  JSON.stringify([right.name, right.access]),
                ).map(({ key, item: right }) => (
                  <li
                    key={key}
                    className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-base bg-inset px-2.5 py-2 text-xs"
                  >
                    <code className="break-all text-secondary">
                      {right.name || copy.aclRightNameMissing}
                    </code>
                    <span className="shrink-0 text-faint">
                      {copy.aclAccess}: {right.access ?? copy.notDeclared}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] leading-relaxed text-faint">{copy.aclRightsNote}</p>
            </section>
          )}

          {inspection.exports.length > 0 && (
            <section aria-labelledby="meta-inspector-exports-heading" className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="meta-inspector-exports-heading" className="font-label uppercase text-faint">
                  {copy.exportsDetails}
                </h3>
                <span className="text-[10px] text-faint">
                  {copy.manifestEntriesCount
                    .replace(
                      "{shown}",
                      String(
                        Math.min(
                          inspection.exports.length,
                          metaInspectorClientPolicy.previewEntries,
                        ),
                      ),
                    )
                    .replace("{total}", String(inspection.exports.length))}
                </span>
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {withOccurrenceKeys(metaInspectorPreview(inspection.exports), (entry) =>
                  JSON.stringify([entry.function, entry.type, entry.http]),
                ).map(({ key, item: entry }) => (
                  <li
                    key={key}
                    className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-base bg-inset px-2.5 py-2 text-xs"
                  >
                    <code className="break-all text-secondary">
                      {entry.function || copy.exportFunctionNameMissing}
                    </code>
                    <span className="text-faint">
                      {copy.exportTypeLabel}: {entry.type ?? copy.notDeclared}
                      {" · "}
                      {copy.httpAttribute}: {entry.http ?? copy.notDeclared}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[10px] leading-relaxed text-faint">{copy.exportsNote}</p>
            </section>
          )}

          {inspection.issues.length > 0 && (
            <div className="space-y-2">
              <div className="font-label uppercase text-faint">{copy.structuralNotes}</div>
              <ul className="space-y-1.5">
                {withOccurrenceKeys(inspection.issues, (issue) =>
                  JSON.stringify([issue.code, issue.severity, issue.message]),
                ).map(({ key, item: issue }) => (
                  <li
                    key={key}
                    className={
                      issue.severity === "error" ? "text-xs text-danger" : "text-xs text-warning"
                    }
                  >
                    {getMtaMetaInspectorIssueMessage(issue, copy.structuralIssues)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-faint">{copy.note}</p>
        </div>
      )}
    </section>
  );
}
