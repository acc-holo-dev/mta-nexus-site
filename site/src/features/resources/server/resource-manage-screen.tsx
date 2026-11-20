import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { resourcePublicationReadinessService } from "../../../lib/services/resources/resource-publication-readiness-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax5xlLoose as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { surfaceP4TextSmSecondary } from "../../shell/surface-shell";
import {
  typeBreakDisplayPrimary,
  typePrewrapBreak,
  typePrewrapSmSecondary,
  typeSemiboldPrimary,
  typeSmSecondary,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import { AuthorResourceForms, RetireBuildForm } from "../author-controls";
import { ResourceLifecycleControls } from "../lifecycle-controls";
import { ResourcePublicationReadinessPanel } from "../publisher-view";
import { getResourceBuildWorkspaceCopy } from "../resource-build-workspace-i18n";
import { getResourceCommerceCopy } from "../resource-commerce-i18n";
import { getResourcePublisherCopy } from "../resource-publisher-i18n";
export async function resourceManageMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).authorResources.manageDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceManageScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [locale, { id }, query] = await Promise.all([getRequestLocale(), params, searchParams]);
  const dictionary = getDictionary(locale);
  const copy = dictionary.authorResources;
  const returnParams = new URLSearchParams();
  if (query.page) returnParams.set("page", query.page);
  const returnQuery = returnParams.toString();
  const resourcePath = `/workspace/resources/${encodeURIComponent(id)}`;
  const returnPath = returnQuery ? `${resourcePath}?${returnQuery}` : resourcePath;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={returnPath}
      />
    );
  }

  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const product = await productService.getManagedProduct(id, actor);
  if (!product) notFound();
  const publisherCopy = getResourcePublisherCopy(locale);
  const loaded = await Promise.all([
    productService.getManagedHistory(id, actor, Number(query.page ?? 1)),
    productService.getResourceLifecycleHistory(id, actor),
    resourcePublicationReadinessService.summary(id, actor),
  ]).catch(() => null);
  if (!loaded) {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/resources" className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={publisherCopy.loadUnavailable}
          description={publisherCopy.loadUnavailableHint}
          action={
            <Link href={returnPath} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const [history, lifecycleHistory, publicationReadiness] = loaded;
  const commerceCopy = getResourceCommerceCopy(locale);
  const buildCopy = getResourceBuildWorkspaceCopy(locale);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/resources" className={linkAccentSm}>
        {copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className={typeBreakDisplayPrimary}>{product.title}</h1>
        <p className="text-secondary">
          {copy.statusLabels[product.status]} · {product.currentVersion}
        </p>
        <Link href={`/market/${product.slug}`} className={linkAccentSm}>
          {copy.preview}
        </Link>
      </header>
      {product.metadataReviewRequired ? (
        <ErrorState
          id="resource-metadata-review-required"
          title={publisherCopy.reviewRequired}
          description={publisherCopy.reviewNote}
        />
      ) : null}
      <ResourcePublicationReadinessPanel
        summary={publicationReadiness}
        locale={locale}
        previewHref={`/market/${product.slug}`}
      />
      <ResourceLifecycleControls
        key={`lifecycle:${product.id}:${product.status}:${new Date(product.updatedAt).toISOString()}`}
        product={{
          id: product.id,
          status: product.status,
          updatedAt: new Date(product.updatedAt).toISOString(),
        }}
      />
      {lifecycleHistory.length > 0 && (
        <section className="space-y-3">
          <h2 className={typeXlSemiboldPrimary}>{commerceCopy.history}</h2>
          <ol className="space-y-3">
            {lifecycleHistory.map((event) => (
              <li key={event.id} className={surfaceP4TextSmSecondary}>
                <p>
                  {event.action === "product.archive"
                    ? commerceCopy.archive
                    : event.action === "product.restore"
                      ? commerceCopy.restore
                      : commerceCopy.submit}
                </p>
                <p className={typePrewrapBreak}>
                  {typeof event.details?.reason === "string" ? event.details.reason : ""}
                </p>
                <time dateTime={new Date(event.createdAt).toISOString()}>
                  {new Date(event.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-GB")}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}
      <AuthorResourceForms
        key={`${actor.id}:${product.id}`}
        actorId={actor.id}
        uploadBlocked={product.status === "archived" || product.status === "suspended"}
        product={{
          id: product.id,
          title: product.title,
          shortDescription: product.shortDescription ?? "",
          description: product.description,
          tags: product.tags,
          updatedAt: new Date(product.updatedAt).toISOString(),
        }}
      />
      <section className="space-y-4">
        <h2 className={typeXlSemiboldPrimary}>{copy.history}</h2>
        {history.builds.length === 0 ? (
          <EmptyState title={copy.noBuilds} description={publisherCopy.readiness.no_build} />
        ) : (
          <ul className="space-y-4">
            {history.builds.map((build) => (
              <li key={build.id} className="space-y-3 rounded-lg border border-base bg-surface p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className={typeSemiboldPrimary}>{build.version}</h3>
                  <time
                    dateTime={new Date(build.createdAt).toISOString()}
                    className="text-sm text-muted"
                  >
                    {new Date(build.createdAt).toLocaleDateString(
                      locale === "ru" ? "ru-RU" : "en-GB",
                    )}
                  </time>
                </div>
                <p className={typeSmSecondary}>
                  {copy.buildLabels[build.status]} · {copy.scan}:{" "}
                  {copy.scanLabels[build.scanStatus as keyof typeof copy.scanLabels] ??
                    copy.scanLabels.unknown}
                </p>
                {build.releaseNotes && (
                  <p className={typePrewrapSmSecondary}>{build.releaseNotes}</p>
                )}
                {build.status === "quarantined" && build.quarantineReason && (
                  <ErrorState
                    id="resource-build-quarantined"
                    title={copy.quarantine}
                    description={build.quarantineReason}
                  />
                )}
                {history.decisions
                  .filter((decision) => decision.buildId === build.id)
                  .map((decision) => (
                    <div
                      key={decision.id}
                      className="border-l-2 border-base pl-3 text-sm text-secondary"
                    >
                      <p>
                        {copy.notes} ·{" "}
                        {buildCopy.actions[decision.action as keyof typeof buildCopy.actions] ??
                          decision.action}
                      </p>
                      <p className={typePrewrapBreak}>
                        {typeof decision.details?.notes === "string"
                          ? decision.details.notes
                          : typeof decision.details?.reason === "string"
                            ? decision.details.reason
                            : ""}
                      </p>
                    </div>
                  ))}
                {build.status !== "retired" &&
                  build.status !== "quarantined" &&
                  Number.isInteger(build.revision) &&
                  (build.revision ?? 0) >= 1 && (
                    <RetireBuildForm
                      productId={id}
                      buildId={build.id}
                      version={build.version}
                      revision={build.revision as number}
                    />
                  )}
                <Link
                  href={`/workspace/resources/${id}/builds/${build.id}`}
                  className={linkAccentSm}
                >
                  {buildCopy.manage}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {history.totalPages > 1 && (
          <nav aria-label={copy.page} className="flex gap-4 text-sm">
            {history.page > 1 && (
              <Link href={`?page=${history.page - 1}`} className={linkAccentSm}>
                {copy.previous}
              </Link>
            )}
            <span>
              {copy.page} {history.page} {copy.of} {history.totalPages}
            </span>
            {history.page < history.totalPages && (
              <Link href={`?page=${history.page + 1}`} className={linkAccentSm}>
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
