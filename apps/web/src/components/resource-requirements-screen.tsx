import { AppError, type ResourceRequirementsScope } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { resourceRequirementsCopy } from "../lib/resource-requirements-i18n";
import { resourceRequirementsQuery } from "../lib/resource-requirements-query";
import { authService } from "../lib/services/auth-service";
import { resourceRequirementsService } from "../lib/services/resource-requirements-service";
import { PlatformSignIn } from "./platform-sign-in";
import { ResourceRequirementsReportBody } from "./resource-requirements-report-body";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function requirementsAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}

function ResourceRequirementsLoadError({
  locale,
  backHref,
  retryHref,
}: {
  locale: "en" | "ru";
  backHref: string;
  retryHref: string;
}) {
  const copy = resourceRequirementsCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <section className={pageShellClass}>
      <Link href={backHref} className={navLinkClass}>
        {copy.back}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        action={
          <Link href={retryHref} className={navLinkClass}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

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
  const copy = resourceRequirementsCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const requirementsBase =
    scope === "library"
      ? `/workspace/library/${encodeURIComponent(productId)}/requirements`
      : scope === "publisher"
        ? `/workspace/resources/${encodeURIComponent(productId)}/requirements`
        : `/admin/resources/${encodeURIComponent(productId)}/requirements`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) for (const entry of value) params.append(key, entry);
    else if (value !== undefined) params.append(key, value);
  }
  const queryString = params.toString();
  const retryHref = queryString ? `${requirementsBase}?${queryString}` : requirementsBase;
  if (!actor) {
    const returnPath = retryHref;
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  if (scope === "moderator" && !["admin", "moderator"].includes(actor.role)) notFound();
  let query: ReturnType<typeof resourceRequirementsQuery>;
  try {
    query = resourceRequirementsQuery(params, scope);
  } catch {
    notFound();
  }
  const back =
    scope === "library"
      ? query.returnFrom && query.previewBuildId
        ? `/workspace/library/${encodeURIComponent(productId)}/versions/compare?${new URLSearchParams({ from: query.returnFrom, to: query.previewBuildId, returnPage: String(query.returnPage ?? 1) })}`
        : `/workspace/library/${encodeURIComponent(productId)}/versions${query.returnPage ? `?page=${query.returnPage}` : ""}`
      : scope === "publisher"
        ? `/workspace/resources/${encodeURIComponent(productId)}/compatibility`
        : `/admin/resources/${encodeURIComponent(productId)}`;
  const report = await resourceRequirementsService
    .report(actor.id, productId, scope, query)
    .catch((error: unknown) => {
      if (requirementsAccessError(error) === "missing") notFound();
      return null;
    });
  if (!report) {
    return <ResourceRequirementsLoadError locale={locale} backHref={back} retryHref={retryHref} />;
  }
  const root = report.nodes.find((node) => node.slug === report.rootSlug);
  const api =
    scope === "library"
      ? `/api/library/${encodeURIComponent(productId)}/requirements`
      : scope === "publisher"
        ? `/api/products/${encodeURIComponent(productId)}/requirements`
        : `/api/admin/resources/${encodeURIComponent(productId)}/requirements`;
  return (
    <div className={pageShellClass}>
      <Link href={back} className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display">{copy.title}</h1>
      <h2 className="break-words">{root?.title}</h2>
      <p className="text-secondary">{copy.note}</p>
      {scope !== "library" && <p className="text-muted">{copy.preview}</p>}
      {query.previewBuildId && (
        <p role="note" className="nexus-panel p-4">
          {copy.libraryPreview}
        </p>
      )}
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
        {query.previewBuildId && (
          <input type="hidden" name="previewBuildId" value={query.previewBuildId} />
        )}
        {query.returnFrom && <input type="hidden" name="returnFrom" value={query.returnFrom} />}
        {query.returnPage && <input type="hidden" name="returnPage" value={query.returnPage} />}
        <Button type="submit">{copy.check}</Button>
      </form>
      <ResourceRequirementsReportBody
        report={report}
        scope={scope}
        locale={locale}
        allowDownloads={!query.previewBuildId}
        exportHref={`${api}/export${params.size ? `?${params}` : ""}`}
      />
    </div>
  );
}
