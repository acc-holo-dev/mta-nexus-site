import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPackageCopy } from "../lib/build-package-i18n";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { getResourceBuildWorkspaceCopy } from "../lib/resource-build-workspace-i18n";
import { resourceMediaCopy } from "../lib/resource-media-i18n";
import { getResourcePublisherCopy } from "../lib/resource-publisher-i18n";
import { resourceRequirementsCopy } from "../lib/resource-requirements-i18n";
import { authService } from "../lib/services/auth-service";
import { resourceBuildWorkspaceService } from "../lib/services/resource-build-workspace-service";
import { BuildModerationControls } from "./build-moderation-controls";
import { BuildPackageEvidencePanel } from "./build-package-evidence";
import { BuildProvenanceDetails } from "./build-provenance-details";
import { ResourceBuildControls } from "./resource-build-controls";
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
    copy = getResourceBuildWorkspaceCopy(locale),
    dictionary = getDictionary(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{dictionary.workspace.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  let detail: Awaited<ReturnType<typeof resourceBuildWorkspaceService.detail>>;
  try {
    detail = await resourceBuildWorkspaceService.detail(productId, buildId, actor, staff);
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 404 || error.statusCode === 403))
      notFound();
    throw error;
  }
  const { product, build, history } = detail;
  const publisherCopy = getResourcePublisherCopy(locale);
  const trustedScan =
    build.scanStatus === "clean" && Boolean(build.scanner?.trim() && build.scannedAt);
  return (
    <div className="space-y-6">
      <Link
        href={staff ? "/admin" : `/workspace/resources/${productId}`}
        className="text-accent underline"
      >
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
        className="text-accent underline"
      >
        {resourceRequirementsCopy(locale).title}
      </Link>
      {product.metadataReviewRequired && (
        <p className="text-sm text-warning">{publisherCopy.reviewRequired}</p>
      )}
      {staff && (
        <Link
          href={`/admin/resources/${encodeURIComponent(productId)}/media`}
          className="text-accent underline"
        >
          {resourceMediaCopy(locale).title}
        </Link>
      )}
      {staff && (
        <section className="nexus-panel space-y-3 p-5" aria-label={publisherCopy.description}>
          <p className="text-sm text-muted">{publisherCopy.reviewNote}</p>
          <h2 className="text-xl font-semibold text-primary">{publisherCopy.description}</h2>
          {product.shortDescription && (
            <p className="whitespace-pre-wrap break-words text-secondary">
              {product.shortDescription}
            </p>
          )}
          <p className="whitespace-pre-wrap break-words text-secondary">{product.description}</p>
          <p className="break-words text-sm text-secondary">
            {publisherCopy.tags}: {(product.tags ?? []).join(", ") || "—"}
          </p>
          <h3 className="font-semibold text-primary">{publisherCopy.requirements}</h3>
          <p className="text-sm text-secondary">
            MTA: {product.compatibility?.mtaMinVersion || "—"}
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
        className="text-sm text-accent underline"
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
        {history.length === 0 && <p className="text-secondary">{copy.noHistory}</p>}
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
      </section>
    </div>
  );
}
