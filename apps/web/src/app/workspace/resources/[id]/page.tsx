import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorResourceForms, RetireBuildForm } from "../../../../components/author-resource-forms";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { ResourceLifecycleControls } from "../../../../components/resource-lifecycle-controls";
import { ResourcePublicationReadinessPanel } from "../../../../components/resource-publication-readiness-panel";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getResourceBuildWorkspaceCopy } from "../../../../lib/resource-build-workspace-i18n";
import { getResourceCommerceCopy } from "../../../../lib/resource-commerce-i18n";
import { getResourcePublisherCopy } from "../../../../lib/resource-publisher-i18n";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";
import { resourcePublicationReadinessService } from "../../../../lib/services/resource-publication-readiness-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-8 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Manage resource | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function ManageResourcePage({
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
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
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
        <Link href="/workspace/resources" className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={publisherCopy.loadUnavailable}
          action={
            <Link href={returnPath} className={navLinkClass}>
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
      <Link href="/workspace/resources" className={navLinkClass}>
        {copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className="break-words font-display text-primary">{product.title}</h1>
        <p className="text-secondary">
          {copy.statusLabels[product.status]} · {product.currentVersion}
        </p>
        <Link href={`/market/${product.slug}`} className={navLinkClass}>
          {copy.preview}
        </Link>
      </header>
      {product.metadataReviewRequired ? (
        <ErrorState id="resource-metadata-review-required" title={publisherCopy.reviewRequired} />
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
          <h2 className="text-xl font-semibold text-primary">{commerceCopy.history}</h2>
          <ol className="space-y-3">
            {lifecycleHistory.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-base p-4 text-sm text-secondary"
              >
                <p>
                  {event.action === "product.archive"
                    ? commerceCopy.archive
                    : event.action === "product.restore"
                      ? commerceCopy.restore
                      : commerceCopy.submit}
                </p>
                <p className="whitespace-pre-wrap break-words">
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
        <h2 className="text-xl font-semibold text-primary">{copy.history}</h2>
        {history.builds.length === 0 ? (
          <EmptyState title={copy.noBuilds} description={publisherCopy.readiness.no_build} />
        ) : (
          <ul className="space-y-4">
            {history.builds.map((build) => (
              <li key={build.id} className="space-y-3 rounded-lg border border-base bg-surface p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-semibold text-primary">{build.version}</h3>
                  <time
                    dateTime={new Date(build.createdAt).toISOString()}
                    className="text-sm text-muted"
                  >
                    {new Date(build.createdAt).toLocaleDateString(
                      locale === "ru" ? "ru-RU" : "en-GB",
                    )}
                  </time>
                </div>
                <p className="text-sm text-secondary">
                  {copy.buildLabels[build.status]} · {copy.scan}:{" "}
                  {copy.scanLabels[build.scanStatus as keyof typeof copy.scanLabels] ??
                    copy.scanLabels.unknown}
                </p>
                {build.releaseNotes && (
                  <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                    {build.releaseNotes}
                  </p>
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
                      <p className="whitespace-pre-wrap break-words">
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
                  className={navLinkClass}
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
              <Link href={`?page=${history.page - 1}`} className={navLinkClass}>
                {copy.previous}
              </Link>
            )}
            <span>
              {copy.page} {history.page} {copy.of} {history.totalPages}
            </span>
            {history.page < history.totalPages && (
              <Link href={`?page=${history.page + 1}`} className={navLinkClass}>
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
