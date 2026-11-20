import { AppError, type ResourceRequirementsScope } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceRequirementsService } from "../../../lib/services/resources/resource-requirements-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccent } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelFlexWrapEndP4, panelP4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeBorderInsetP2, typeGridGap1 } from "../../shell/type-shell";
import { ResourceRequirementsReportBody } from "../components/resource-requirements-report-body";
import { resourceRequirementsCopy } from "../resource-requirements-i18n";
import { resourceRequirementsQuery } from "../resource-requirements-query";

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
    <section className={pageShellMax5xl}>
      <Link href={backHref} className={linkAccent}>
        {copy.back}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={linkAccent}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function resourceRequirementsMetadata(): Promise<Metadata> {
  return {
    title: `${resourceRequirementsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
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
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/resources/"}
      />
    );
  }

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
    <div className={pageShellMax5xl}>
      <Link href={back} className={linkAccent}>
        {copy.back}
      </Link>
      <h1 className="font-display">{copy.title}</h1>
      <h2 className="break-words">{root?.title}</h2>
      <p className="text-secondary">{copy.note}</p>
      {scope !== "library" && <p className="text-muted">{copy.preview}</p>}
      {query.previewBuildId && (
        <p role="note" className={panelP4}>
          {copy.libraryPreview}
        </p>
      )}
      <form className={panelFlexWrapEndP4}>
        <label className={typeGridGap1}>
          {copy.target}
          <input
            name="targetMta"
            maxLength={64}
            placeholder={copy.targetPlaceholder}
            defaultValue={query.targetMta}
            className={typeBorderInsetP2}
            required
          />
        </label>
        {query.buildId && <input type="hidden" name="buildId" value={query.buildId} />}
        {query.previewBuildId && (
          <input type="hidden" name="previewBuildId" value={query.previewBuildId} />
        )}
        {query.returnFrom && <input type="hidden" name="returnFrom" value={query.returnFrom} />}
        {query.returnPage && <input type="hidden" name="returnPage" value={query.returnPage} />}
        <Button type="submit" size="touch">
          {copy.check}
        </Button>
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

export async function PublisherResourceRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  return ResourceRequirementsScreen({ productId: id, scope: "publisher", raw });
}

export async function ModeratorResourceRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  return ResourceRequirementsScreen({ productId: id, scope: "moderator", raw });
}

export async function LibraryResourceRequirementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, raw] = await Promise.all([params, searchParams]);
  return ResourceRequirementsScreen({ productId: id, scope: "library", raw });
}
