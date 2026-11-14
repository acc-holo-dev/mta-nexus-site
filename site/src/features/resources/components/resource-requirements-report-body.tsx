import type { ResourceRequirementsReport, ResourceRequirementsScope } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { resourceRequirementsCopy } from "../../../lib/resource-requirements-i18n";
import { AddResourceToCart } from "../../../components/resource-cart-controls";
import { ResourceDownloadButton } from "../download";

export function ResourceRequirementsReportBody({
  report,
  scope,
  locale,
  exportHref,
  showState = true,
  allowDownloads = true,
  suppressEmptyIssues = false,
}: {
  report: ResourceRequirementsReport;
  scope: ResourceRequirementsScope;
  locale: string;
  exportHref: string;
  showState?: boolean;
  allowDownloads?: boolean;
  suppressEmptyIssues?: boolean;
}) {
  const copy = resourceRequirementsCopy(locale);
  return (
    <>
      {showState &&
        (report.state === "ready" ? (
          <p role="status" className="font-semibold">
            {copy.states[report.state]}
          </p>
        ) : (
          <ErrorState
            id={
              report.state === "blocked"
                ? "resource-requirements-report-blocked"
                : "resource-requirements-report-review"
            }
            title={copy.states[report.state]}
            description={
              report.issues[0]
                ? `${report.issues[0].slug} · ${copy.codes[report.issues[0].code]}`
                : report.cycles[0]
                  ? report.cycles[0].join(" → ")
                  : undefined
            }
          />
        ))}
      <p className="text-sm text-muted">
        {copy.snapshot}: {report.generatedAt}
      </p>
      {scope === "library" && (
        <p>
          {copy.size}: {report.downloadableBytes}
        </p>
      )}
      <a
        href={exportHref}
        className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.export}
      </a>
      {(report.issues.length > 0 || !suppressEmptyIssues) && (
        <section className="nexus-panel space-y-3 p-4">
          <h2>{copy.issues}</h2>
          {report.issues.length ? (
            <ul className="space-y-2">
              {report.issues.map((issue) => (
                <li key={`${issue.code}:${issue.slug}`} className="break-words">
                  <code>{issue.slug}</code> · {copy.codes[issue.code]}
                </li>
              ))}
            </ul>
          ) : (
            <p>{copy.none}</p>
          )}
          {report.cycles.map((cycle) => (
            <ErrorState
              key={cycle.join(":")}
              id={`resource-requirements-cycle-${cycle.join("-")}`}
              title={cycle.join(" → ")}
            />
          ))}
        </section>
      )}
      {report.order.length > 0 && (
        <section className="space-y-2">
          <h2>{copy.order}</h2>
          <p className="text-sm text-muted">{copy.orderNote}</p>
          <ol className="list-inside list-decimal">
            {report.order.map((slug) => (
              <li key={slug} className="break-words">
                {slug}
              </li>
            ))}
          </ol>
        </section>
      )}
      <ul className="space-y-4">
        {report.nodes.map((node) => (
          <li key={node.id} className="nexus-panel space-y-3 p-4">
            <h3 className="break-words font-semibold">{node.title}</h3>
            <code>{node.slug}</code>
            <p>
              {copy.selection}: {copy.modes[node.selection]} · {copy.version}:{" "}
              {node.build?.version ?? copy.unknown}
            </p>
            <p>
              {copy.minimum}: {node.minimumMta ?? copy.unknown} · {copy.targetBuild}:{" "}
              {node.build?.mtaTarget ?? copy.unknown}
            </p>
            {scope === "library" && (
              <p>
                {copy.access}: {node.accessible ? copy.yes : copy.no}
              </p>
            )}
            {node.build && (
              <p className="break-all text-xs">
                {copy.hash}: {node.build.sha256Hash}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {node.published && (
                <Link
                  href={`/market/${encodeURIComponent(node.slug)}`}
                  className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {copy.catalog}
                </Link>
              )}
              {scope === "library" && !node.accessible && node.published && (
                <AddResourceToCart productId={node.id} signedIn />
              )}
              {scope === "library" && node.accessible && (
                <Link
                  href={`/workspace/library/${encodeURIComponent(node.id)}/versions`}
                  className="rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {copy.inspect}
                </Link>
              )}
            </div>
            {allowDownloads &&
              scope === "library" &&
              node.accessible &&
              node.published &&
              node.build?.safe && (
                <ResourceDownloadButton
                  productId={node.id}
                  buildId={node.build.id}
                  version={node.build.version}
                />
              )}
          </li>
        ))}
      </ul>
    </>
  );
}
