"use client";

import { FileSearch, LoaderCircle } from "lucide-react";
import { useState } from "react";

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
};

const MAX_META_BYTES = 256 * 1024;

export function MtaMetaInspectorPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<InspectionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function inspect() {
    if (!file || loading) return;
    setLoading(true);
    setResult(null);

    try {
      if (file.size > MAX_META_BYTES) {
        setResult({ error: "meta.xml is larger than the 256 KiB inspection limit." });
        return;
      }

      const source = await file.text();
      const response = await fetch("/api/resources/inspect-meta", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: source,
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await response.json().catch(() => null)) as
        | InspectionResponse
        | null;

      if (!response.ok || !data) {
        setResult({
          error: data?.error || "meta.xml inspection is temporarily unavailable.",
        });
        return;
      }

      setResult(data);
    } catch {
      setResult({ error: "meta.xml inspection is temporarily unavailable." });
    } finally {
      setLoading(false);
    }
  }

  const inspection = result?.inspection;

  return (
    <section
      className="nexus-panel p-5 space-y-4"
      aria-labelledby="meta-inspector-heading"
    >
      <div className="flex items-start gap-3">
        <FileSearch className="mt-0.5 h-5 w-5 text-blue-400" aria-hidden="true" />
        <div>
          <h2 id="meta-inspector-heading" className="text-sm font-bold text-white">
            Inspect meta.xml
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            Optional static manifest preview. It does not scan the build archive
            and does not produce a security verdict.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-xs text-neutral-300">meta.xml file</span>
          <input
            type="file"
            accept=".xml,text/xml,text/plain"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }}
            className="w-full text-sm text-neutral-300"
          />
        </label>
        <button
          type="button"
          disabled={!file || loading}
          onClick={inspect}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-xs font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading && (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {loading ? "Inspecting..." : "Inspect manifest"}
        </button>
      </div>

      {result?.error && (
        <p role="alert" className="text-xs text-amber-300">
          {result.error}
        </p>
      )}

      {inspection && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-base bg-neutral-950/50 p-3">
              <div className="text-[10px] uppercase text-neutral-500">Scripts</div>
              <div className="mt-1 text-lg font-black text-white">
                {inspection.summary.scriptCount}
              </div>
              <div className="text-[10px] text-neutral-500">
                {inspection.summary.serverScripts} server ·{" "}
                {inspection.summary.clientScripts} client ·{" "}
                {inspection.summary.sharedScripts} shared
              </div>
            </div>
            <div className="rounded-lg border border-base bg-neutral-950/50 p-3">
              <div className="text-[10px] uppercase text-neutral-500">Files</div>
              <div className="mt-1 text-lg font-black text-white">
                {inspection.summary.fileCount}
              </div>
            </div>
            <div className="rounded-lg border border-base bg-neutral-950/50 p-3">
              <div className="text-[10px] uppercase text-neutral-500">
                Dependencies
              </div>
              <div className="mt-1 text-lg font-black text-white">
                {inspection.summary.dependencyCount}
              </div>
            </div>
            <div className="rounded-lg border border-base bg-neutral-950/50 p-3">
              <div className="text-[10px] uppercase text-neutral-500">Exports</div>
              <div className="mt-1 text-lg font-black text-white">
                {inspection.summary.exportCount}
              </div>
              {inspection.summary.httpExportCount > 0 && (
                <div className="text-[10px] text-amber-300">
                  {inspection.summary.httpExportCount} HTTP-enabled
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
                  <dt className="text-neutral-500">Resource name</dt>
                  <dd className="text-neutral-200">{inspection.info.name}</dd>
                </>
              )}
              {inspection.info?.author && (
                <>
                  <dt className="text-neutral-500">Declared author</dt>
                  <dd className="text-neutral-200">{inspection.info.author}</dd>
                </>
              )}
              {inspection.minMtaVersion && (
                <>
                  <dt className="text-neutral-500">Minimum MTA</dt>
                  <dd className="font-mono text-neutral-200">
                    {inspection.minMtaVersion.both ||
                      [
                        inspection.minMtaVersion.server &&
                          `server ${inspection.minMtaVersion.server}`,
                        inspection.minMtaVersion.client &&
                          `client ${inspection.minMtaVersion.client}`,
                      ]
                        .filter(Boolean)
                        .join(" · ") ||
                      "Not declared"}
                  </dd>
                </>
              )}
            </dl>
          )}

          {inspection.dependencyResources.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                Included resources
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inspection.dependencyResources.map((dependency) => (
                  <span
                    key={dependency}
                    className="rounded border border-base bg-neutral-900 px-2 py-1 font-mono text-[10px] text-neutral-300"
                  >
                    {dependency}
                  </span>
                ))}
              </div>
            </div>
          )}

          {inspection.issues.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">
                Structural notes
              </div>
              <ul className="space-y-1.5">
                {inspection.issues.map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className={
                      issue.severity === "error"
                        ? "text-xs text-red-300"
                        : "text-xs text-amber-300"
                    }
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] leading-relaxed text-neutral-500">
            {result.note}
          </p>
        </div>
      )}
    </section>
  );
}
