import { AppError, type ResourceRequirementsScope } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../lib/i18n-server";
import { resourceRequirementsCopy } from "../lib/resource-requirements-i18n";
import { resourceRequirementsQuery } from "../lib/resource-requirements-query";
import { authService } from "../lib/services/auth-service";
import { resourceRequirementsService } from "../lib/services/resource-requirements-service";
import { AddResourceToCart } from "./resource-cart-controls";
import { ResourceDownloadButton } from "./resource-download-button";
export async function ResourceRequirementsScreen({
  productId,
  scope,
  raw,
}: {
  productId: string;
  scope: ResourceRequirementsScope;
  raw: Record<string, string | string[] | undefined>;
}) {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) notFound();
  if (scope === "moderator" && !["admin", "moderator"].includes(actor.role)) notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const entry of value) params.append(key, entry);
    else if (value !== undefined) params.append(key, value);
  }
  let query: ReturnType<typeof resourceRequirementsQuery>;
  try {
    query = resourceRequirementsQuery(params, scope);
  } catch {
    notFound();
  }
  const report = await resourceRequirementsService
    .report(actor.id, productId, scope, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      throw error;
    });
  const copy = resourceRequirementsCopy(locale),
    root = report.nodes.find((node) => node.slug === report.rootSlug);
  const back =
    scope === "library"
      ? `/workspace/library/${encodeURIComponent(productId)}/versions`
      : scope === "publisher"
        ? `/workspace/resources/${encodeURIComponent(productId)}/compatibility`
        : `/admin/resources/${encodeURIComponent(productId)}`;
  const api =
    scope === "library"
      ? `/api/library/${encodeURIComponent(productId)}/requirements`
      : scope === "publisher"
        ? `/api/products/${encodeURIComponent(productId)}/requirements`
        : `/api/admin/resources/${encodeURIComponent(productId)}/requirements`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href={back} className="text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display">{copy.title}</h1>
      <h2 className="break-words">{root?.title}</h2>
      <p className="text-secondary">{copy.note}</p>
      {scope !== "library" && <p className="text-muted">{copy.preview}</p>}
      <form className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        <label className="grid gap-1">
          {copy.target}
          <input
            name="targetMta"
            maxLength={64}
            placeholder="1.6.0-9.22279.0"
            defaultValue={query.targetMta}
            className="border border-base bg-inset p-2"
            required
          />
        </label>
        {query.buildId && <input type="hidden" name="buildId" value={query.buildId} />}
        <button type="submit">{copy.check}</button>
      </form>
      <p role="status" className="font-semibold">
        {copy.states[report.state]}
      </p>
      <p className="text-sm text-muted">
        {copy.snapshot}: {report.generatedAt}
      </p>
      {scope === "library" && (
        <p>
          {copy.size}: {report.downloadableBytes}
        </p>
      )}
      <a href={`${api}/export${params.size ? `?${params}` : ""}`} className="text-accent underline">
        {copy.export}
      </a>
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
          <p key={cycle.join(":")} className="break-words text-danger">
            {cycle.join(" → ")}
          </p>
        ))}
      </section>
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
                  className="text-accent underline"
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
                  className="text-accent underline"
                >
                  {copy.inspect}
                </Link>
              )}
            </div>
            {scope === "library" && node.accessible && node.published && node.build?.safe && (
              <ResourceDownloadButton
                productId={node.id}
                buildId={node.build.id}
                version={node.build.version}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
