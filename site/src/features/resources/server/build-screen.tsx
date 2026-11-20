import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { History } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { formatUnknown } from "../../../lib/i18n/unknown";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceBuildWorkspaceService } from "../../../lib/services/resources/resource-build-workspace-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { buildPackageCopy } from "../build-package-i18n";
import { BuildModerationControls } from "../components/build-moderation-controls";
import { ResourceBuildControls } from "../components/resource-build-controls";
import { BuildPackageEvidencePanel, BuildProvenanceDetails } from "../evidence";
import { getResourceBuildWorkspaceCopy } from "../resource-build-workspace-i18n";
import { getResourceManagementCopy } from "../resource-management-i18n";
import { resourceMediaCopy } from "../resource-media-i18n";
import { getResourcePublisherCopy } from "../resource-publisher-i18n";
import { resourceRequirementsCopy } from "../resource-requirements-i18n";

import { linkAccent } from "../../shell/link-shell";
function buildAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}

function ResourceBuildLoadError({
  locale,
  backHref,
  backLabel,
  retryHref,
}: {
  locale: "en" | "ru";
  backHref: string;
  backLabel: string;
  retryHref: string;
}) {
  const copy = getResourceBuildWorkspaceCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <section className={pageShellClass}>
      <Link href={backHref} className={linkAccent}>
        {backLabel}
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

export async function resourceBuildMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceBuildWorkspaceCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceBuildScreen({
  productId,
  buildId,
  staff = false,
}: {
  productId: string;
  buildId: string;
  staff?: boolean;
}) {
  const locale = await getRequestLocale(),
    copy = getResourceBuildWorkspaceCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/"}
      />
    );
  }

  const returnPath = `/${staff ? "admin/resources" : "workspace/resources"}/${encodeURIComponent(productId)}/builds/${encodeURIComponent(buildId)}`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let detail: Awaited<ReturnType<typeof resourceBuildWorkspaceService.detail>> | null = null;
  try {
    detail = await resourceBuildWorkspaceService.detail(productId, buildId, actor, staff);
  } catch (error) {
    if (buildAccessError(error) === "missing") notFound();
    return (
      <ResourceBuildLoadError
        locale={locale}
        backHref={staff ? "/admin" : `/workspace/resources/${encodeURIComponent(productId)}`}
        backLabel={staff ? copy.reviewBack : copy.back}
        retryHref={returnPath}
      />
    );
  }
  const { product, build, history } = detail;
  const publisherCopy = getResourcePublisherCopy(locale);
  const managementCopy = getResourceManagementCopy(locale);
  const trustedScan =
    build.scanStatus === "clean" && Boolean(build.scanner?.trim() && build.scannedAt);
  return (
    <div className={pageShellClass}>
      <Link href={staff ? "/admin" : `/workspace/resources/${productId}`} className={linkAccent}>
        {staff ? copy.reviewBack : copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className="font-display text-primary">
          {product.title} · {build.version}
        </h1>
        <p className="text-secondary">
          {copy.title} · {copy.statuses[build.status]} · {copy.revision}: {build.revision}
        </p>
      </header>
      <Link
        href={`${staff ? "/admin/resources" : "/workspace/resources"}/${encodeURIComponent(productId)}/requirements?buildId=${encodeURIComponent(buildId)}`}
        className={linkAccent}
      >
        {resourceRequirementsCopy(locale).title}
      </Link>
      {product.metadataReviewRequired ? (
        <ErrorState
          id="resource-metadata-review-required"
          title={publisherCopy.reviewRequired}
          description={publisherCopy.reviewRequiredHint}
        />
      ) : null}
      {staff && (
        <Link
          href={`/admin/resources/${encodeURIComponent(productId)}/media`}
          className={linkAccent}
        >
          {resourceMediaCopy(locale).title}
        </Link>
      )}
      {staff && (
        <section className={panelSpace3P5} aria-label={publisherCopy.description}>
          <p className="text-sm text-muted">{publisherCopy.reviewNote}</p>
          <h2 className="text-xl font-semibold text-primary">{publisherCopy.description}</h2>
          {product.shortDescription && (
            <p className="whitespace-pre-wrap break-words text-secondary">
              {product.shortDescription}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words text-secondary">{product.description}</p>
          <p className="break-words text-sm text-secondary">
            {publisherCopy.tags}: {formatUnknown(locale, (product.tags ?? []).join(", "))}
          </p>
          <h3 className="font-semibold text-primary">{publisherCopy.requirements}</h3>
          <p className="text-sm text-secondary">
            {managementCopy.mta}: {formatUnknown(locale, product.compatibility?.mtaMinVersion)}
          </p>
          <ul className="list-inside list-disc text-sm text-secondary">
            {(product.compatibility?.dependencies ?? []).map((slug) => (
              <li key={slug} className="break-words">
                {slug}
              </li>
            ))}
          </ul>
        </section>
      )}
      <BuildProvenanceDetails
        build={{
          id: build.id,
          version: build.version,
          status: build.status,
          sha256Hash: build.sha256Hash,
          fileName: build.fileName,
          fileSizeBytes: build.fileSizeBytes,
          scanStatus: build.scanStatus,
          scanner: build.scanner ?? undefined,
          scannedAt: build.scannedAt ?? undefined,
          mtaVersionTarget: build.mtaVersionTarget ?? undefined,
          isSigned: build.isSigned,
        }}
        locale={locale}
      />
      {build.releaseNotes && (
        <section className="space-y-2">
          <h2 className="text-xl text-primary">{copy.notes}</h2>
          <p className="whitespace-pre-wrap break-words text-secondary">{build.releaseNotes}</p>
        </section>
      )}
      <Link
        href={`/${staff ? "admin/resources" : "workspace/resources"}/${encodeURIComponent(productId)}/builds/${encodeURIComponent(buildId)}/package`}
        className={linkAccent}
      >
        {buildPackageCopy(locale).inventory}
      </Link>
      <BuildPackageEvidencePanel
        evidence={build.packageEvidence}
        locale={locale}
        reportHref={`/api/${staff ? "admin/resources" : "products"}/${encodeURIComponent(productId)}/builds/${encodeURIComponent(buildId)}/package`}
      />
      {staff ? (
        build.status === "pending_review" &&
        product.status !== "archived" &&
        product.status !== "suspended" && (
          <BuildModerationControls
            key={`${build.id}:${build.revision}`}
            buildId={build.id}
            expectedRevision={build.revision}
            scanStatus={build.scanStatus}
            hasScanProvenance={trustedScan}
          />
        )
      ) : (
        <ResourceBuildControls
          key={`${actor.id}:${build.id}:${build.revision}:${product.status}`}
          build={{
            id: build.id,
            productId,
            version: build.version,
            status: build.status,
            revision: build.revision,
            releaseNotes: build.releaseNotes,
            mtaVersionTarget: build.mtaVersionTarget,
          }}
          withdrawn={product.status === "archived" || product.status === "suspended"}
          trustedScan={trustedScan}
        />
      )}
      <section className="space-y-3">
        <h2 className="text-xl text-primary">{copy.history}</h2>
        {history.length === 0 ? (
          <EmptyState
            title={copy.noHistory}
            description={copy.history}
            icon={<History className="h-6 w-6" aria-hidden="true" />}
          />
        ) : (
          <ol className="space-y-3">
            {history.map((event) => (
              <li key={event.id} className="rounded-lg border border-base p-4">
                <p>{copy.actions[event.action as keyof typeof copy.actions] ?? event.action}</p>
                {event.reason && (
                  <p className="whitespace-pre-wrap break-words text-secondary">{event.reason}</p>
                )}
                <time
                  dateTime={new Date(event.createdAt).toISOString()}
                  className="text-sm text-muted"
                >
                  {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB")}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
