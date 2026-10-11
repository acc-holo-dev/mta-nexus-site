import { ResourceLifecycleControls } from "../../../../components/resource-lifecycle-controls";
import { getResourceCommerceCopy } from "../../../../lib/resource-commerce-i18n";
import { getResourceManagementCopy } from "../../../../lib/resource-management-i18n";
import { getResourceActivityCopy } from "../../../../lib/resource-activity-i18n";
import { getResourceReleaseControlCopy } from "../../../../lib/resource-release-control-i18n";
import { getResourcePublisherCopy } from "../../../../lib/resource-publisher-i18n";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getResourceBuildWorkspaceCopy } from "../../../../lib/resource-build-workspace-i18n";
import { AuthorResourceForms } from "../../../../components/author-resource-forms";

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
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.authorResources;
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{dictionary.workspace.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {dictionary.workspace.signIn}
        </Link>
      </section>
    );
  const { id } = await params;
  const product = await productService.getManagedProduct(id, actor);
  if (!product) notFound();
  const [history, lifecycleHistory] = await Promise.all([
    productService.getManagedHistory(id, actor, Number((await searchParams).page ?? 1)),
    productService.getResourceLifecycleHistory(id, actor),
  ]);
  const commerceCopy = getResourceCommerceCopy(locale);
  const buildCopy = getResourceBuildWorkspaceCopy(locale);
  const managementCopy = getResourceManagementCopy(locale);
  const publisherCopy = getResourcePublisherCopy(locale);
  return (
    <div className="space-y-8">
      <Link href="/workspace/resources" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <header className="space-y-2">
        <h1 className="break-words font-display text-primary">{product.title}</h1>
        <p className="text-secondary">
          {copy.statusLabels[product.status]} · {product.currentVersion}
        </p>
        <Link href={`/market/${product.slug}`} className="text-sm text-accent underline">
          {copy.preview}
        </Link>
      </header>
      {product.metadataReviewRequired && (
        <p className="text-sm text-warning">{publisherCopy.reviewRequired}</p>
      )}
      <nav
        className="flex flex-wrap gap-4 text-sm text-accent"
        aria-label={managementCopy.variants}
      >
        <Link href={`/workspace/resources/${product.id}/variants`} className="underline">
          {managementCopy.variants}
        </Link>
        <Link href={`/workspace/resources/${product.id}/compatibility`} className="underline">
          {managementCopy.compatibility}
        </Link>
        <Link href={`/workspace/resources/${product.id}/activity`} className="underline">
          {getResourceActivityCopy(locale).analytics}
        </Link>
        <Link href={`/workspace/resources/${product.id}/moderation`} className="underline">
          {getResourceReleaseControlCopy(locale).moderationHistory}
        </Link>
        <Link href={`/workspace/resources/${product.id}/history`} className="underline">
          {publisherCopy.history}
        </Link>
      </nav>
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
        {history.builds.length === 0 && <p className="text-secondary">{copy.noBuilds}</p>}
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
                <p className="whitespace-pre-wrap break-words text-sm text-danger">
                  {copy.quarantine}: {build.quarantineReason}
                </p>
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
              <Link
                href={`/workspace/resources/${id}/builds/${build.id}`}
                className="text-sm text-accent underline"
              >
                {buildCopy.manage}
              </Link>
            </li>
          ))}
        </ul>
        {history.totalPages > 1 && (
          <nav aria-label={copy.page} className="flex gap-4 text-sm">
            {history.page > 1 && (
              <Link href={`?page=${history.page - 1}`} className="text-accent underline">
                {copy.previous}
              </Link>
            )}
            <span>
              {copy.page} {history.page} {copy.of} {history.totalPages}
            </span>
            {history.page < history.totalPages && (
              <Link href={`?page=${history.page + 1}`} className="text-accent underline">
                {copy.next}
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
