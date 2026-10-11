import {
  buildPackageSummary,
  type BuildPackageEvidence,
  type BuildPackageSummary,
} from "@nexus/domain";
import { getDictionary } from "../lib/i18n";
import { getMtaMetaInspectorIssueMessage } from "../lib/mta-meta-inspector-messages";
import { buildPackageCopy } from "../lib/build-package-i18n";

export function BuildPackageSummaryPanel({
  summary,
  locale,
}: {
  summary: BuildPackageSummary;
  locale: "ru" | "en";
}) {
  const copy = buildPackageCopy(locale);
  return (
    <section
      className="space-y-2 rounded-lg border border-base p-4 text-sm"
      aria-label={copy.title}
    >
      <h3 className="font-semibold text-primary">{copy.title}</h3>
      {!summary ? (
        <p className="text-muted">{copy.legacy}</p>
      ) : (
        <>
          <p className="text-secondary">
            {summary.status === "checked" ? copy.checked : copy.unchecked} ·{" "}
            {summary.format.toUpperCase()}
          </p>
          {summary.archive && (
            <dl className="flex flex-wrap gap-5 text-secondary">
              <div>
                <dt>{copy.entries}</dt>
                <dd>{summary.archive.entries.toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt>{copy.files}</dt>
                <dd>{summary.archive.files.toLocaleString(locale)}</dd>
              </div>
              <div>
                <dt>{copy.unpacked}</dt>
                <dd>{summary.archive.unpackedBytes.toLocaleString(locale)}</dd>
              </div>
            </dl>
          )}
          {summary.status === "checked" && (
            <p>
              {copy.manifest}:{" "}
              {summary.manifestStatus === "single"
                ? copy.single
                : summary.manifestStatus === "multiple"
                  ? copy.multiple
                  : copy.missing}
            </p>
          )}
          {summary.scripts && (
            <p>
              {copy.scripts}: {copy.server} {summary.scripts.server} · {copy.client}{" "}
              {summary.scripts.client} · {copy.shared} {summary.scripts.shared} · {copy.unknown}{" "}
              {summary.scripts.unknown}
            </p>
          )}
          {(summary.missingReferences > 0 || summary.unresolvedReferences > 0) && (
            <p className="text-warning">
              {copy.references}: {copy.absent} {summary.missingReferences} · {copy.unknown}{" "}
              {summary.unresolvedReferences}
            </p>
          )}
          {summary.referencesTruncated && <p className="text-warning">{copy.truncated}</p>}
        </>
      )}
      <p className="text-xs text-muted">{copy.publicNote}</p>
    </section>
  );
}

export function BuildPackageEvidencePanel({
  evidence,
  locale,
  reportHref,
}: {
  evidence: BuildPackageEvidence | null | undefined;
  locale: "ru" | "en";
  reportHref: string;
}) {
  const copy = buildPackageCopy(locale),
    manifest = evidence?.manifest;
  const labels = {
    present: copy.present,
    missing: copy.absent,
    pattern: copy.pattern,
    external: copy.external,
    unsafe: copy.unsafe,
  };
  return (
    <div className="space-y-4">
      <BuildPackageSummaryPanel summary={buildPackageSummary(evidence)} locale={locale} />
      {evidence && (
        <>
          <p className="text-xs text-muted">
            {copy.inspected}:{" "}
            <time dateTime={evidence.inspectedAt}>
              {new Date(evidence.inspectedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB")}
            </time>
          </p>
          <a href={reportHref} className="text-sm text-accent underline">
            {copy.export}
          </a>
          <p className="text-sm text-muted">{copy.note}</p>
          {manifest && (
            <section className="space-y-4 rounded-lg border border-base p-4 text-sm">
              <p className="break-words font-code">{manifest.path}</p>
              <code className="block break-all text-xs">SHA-256: {manifest.sha256Hash}</code>
              <h3 className="font-semibold">{copy.minimum}</h3>
              <p className="break-words">
                {copy.server}: {manifest.minimumMta?.server || "—"} · {copy.client}:{" "}
                {manifest.minimumMta?.client || "—"} · {copy.shared}:{" "}
                {manifest.minimumMta?.both || "—"}
              </p>
              <h3 className="font-semibold">{copy.dependencies}</h3>
              <p className="text-muted">{copy.dependenciesNote}</p>
              <ul className="list-inside list-disc">
                {[...new Set(manifest.dependencies)].map((v) => (
                  <li key={v} className="break-words">
                    {v}
                  </li>
                ))}
              </ul>
              <h3 className="font-semibold">{copy.acl}</h3>
              <ul className="list-inside list-disc">
                {[...new Set(manifest.aclRights)].map((v) => (
                  <li key={v} className="break-words">
                    {v || "—"}
                  </li>
                ))}
              </ul>
              <h3 className="font-semibold">{copy.references}</h3>
              <ul className="space-y-2">
                {[
                  ...new Map(
                    manifest.references.map((v) => [JSON.stringify([v.kind, v.path, v.status]), v]),
                  ).values(),
                ].map((v) => (
                  <li key={JSON.stringify([v.kind, v.path, v.status])} className="break-words">
                    <code>{v.path || "—"}</code> · {v.kind} ·{" "}
                    <span className={v.status === "present" ? "text-success" : "text-warning"}>
                      {labels[v.status]}
                    </span>
                  </li>
                ))}
              </ul>
              {manifest.referencesTruncated && <p className="text-warning">{copy.truncated}</p>}
              {manifest.issues.length > 0 && (
                <>
                  <h3 className="font-semibold">{copy.issues}</h3>
                  <ul className="list-inside list-disc text-warning">
                    {[
                      ...new Map(
                        manifest.issues.map((v) => [`${v.code}:${v.severity}`, v]),
                      ).values(),
                    ].map((v) => (
                      <li key={`${v.code}:${v.severity}`}>
                        {getMtaMetaInspectorIssueMessage(
                          { ...v, message: copy.genericIssue },
                          getDictionary(locale).metaInspector.structuralIssues,
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
