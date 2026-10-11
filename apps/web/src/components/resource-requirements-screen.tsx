import { AppError, type ResourceRequirementsScope } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../lib/i18n-server";
import { resourceRequirementsCopy } from "../lib/resource-requirements-i18n";
import { resourceRequirementsQuery } from "../lib/resource-requirements-query";
import { authService } from "../lib/services/auth-service";
import { resourceRequirementsService } from "../lib/services/resource-requirements-service";
import { ResourceRequirementsReportBody } from "./resource-requirements-report-body";
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
      <ResourceRequirementsReportBody
        report={report}
        scope={scope}
        locale={locale}
        exportHref={`${api}/export${params.size ? `?${params}` : ""}`}
      />
    </div>
  );
}
