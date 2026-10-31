import { config } from "@nexus/config";
import { resourceMediaRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { CheckCircle2, Key, Layers, MessageSquare, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildProvenanceDetails } from "../../../components/build-provenance-details";
import { ProductDependencyList } from "../../../components/product-dependency-list";
import { AddResourceToCart } from "../../../components/resource-cart-controls";
import { ResourceDownloadButton } from "../../../components/resource-download-button";
import { ResourceGallery } from "../../../components/resource-gallery";
import { ResourcePreview } from "../../../components/resource-preview";
import { ResourceReviewList } from "../../../components/resource-review-list";
import { ResourceVariantChoices } from "../../../components/resource-variant-choices";
import { ReverseDependencyList } from "../../../components/reverse-dependency-list";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { PRODUCT_PUBLISHING_KEYS } from "../../../lib/product-type-labels";
import { getReleaseHistoryCopy, releaseHistoryHref } from "../../../lib/public-release-history";
import { safeResourceImageUrl } from "../../../lib/resource-image-url";
import { resourceReviewCopy } from "../../../lib/resource-review-i18n";
import { authService } from "../../../lib/services/auth-service";
import { commerceService } from "../../../lib/services/commerce-service";
import { productService } from "../../../lib/services/product-service";
import { resourceManagementService } from "../../../lib/services/resource-management-service";
import { resourceReviewService } from "../../../lib/services/resource-review-service";

export const dynamic = "force-dynamic";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatScanStatus(
  status: string,
  copy: ReturnType<typeof getDictionary>["product"],
): string {
  if (status === "clean") return copy.scanClean;
  if (status === "not_scanned") return copy.scanReview;
  if (status === "error") return copy.scanUnavailable;
  return copy.scanBlocked;
}

function formatProductStatus(
  status: string,
  copy: ReturnType<typeof getDictionary>["product"],
): string {
  if (status === "draft") return copy.statusDraft;
  if (status === "pending_review") return copy.statusPendingReview;
  if (status === "published") return copy.statusPublished;
  if (status === "suspended") return copy.statusSuspended;
  if (status === "archived") return copy.statusArchived;
  return status.replace(/_/g, " ");
}

function formatBuildStatus(
  status: string,
  copy: ReturnType<typeof getDictionary>["product"],
): string {
  if (status === "draft") return copy.buildDraft;
  if (status === "testing") return copy.buildTesting;
  if (status === "pending_review") return copy.buildPendingReview;
  if (status === "published") return copy.buildPublished;
  if (status === "rejected") return copy.buildRejected;
  if (status === "deprecated") return copy.buildDeprecated;
  if (status === "retired") return copy.buildRetired;
  return status.replace(/_/g, " ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [locale, product] = await Promise.all([
    getRequestLocale(),
    productService.getProductBySlug(slug),
  ]);
  const dictionary = getDictionary(locale);

  if (!product) {
    return { title: dictionary.product.notFound, robots: { index: false, follow: false } };
  }

  const description = product.shortDescription || product.description.slice(0, 155);
  const previewUrl = safeResourceImageUrl(product.thumbnailUrl);
  const thumbnailUrl = previewUrl?.startsWith("/")
    ? new URL(previewUrl, config.NEXT_PUBLIC_APP_URL).href
    : previewUrl;

  return {
    title: product.title,
    description,
    alternates: { canonical: `/market/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: "website",
      images: thumbnailUrl ? [{ url: thumbnailUrl }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [locale, user] = await Promise.all([
    getRequestLocale(),
    cookies().then((cookieStore) =>
      authService.getSession(cookieStore.get("nexus_session")?.value),
    ),
  ]);
  const dictionary = getDictionary(locale);
  const copy = dictionary.product;
  const product = await productService.getProductPreviewBySlug(slug, user);

  if (!product) {
    notFound();
  }

  const managementAccess = user
    ? productService.canManageProduct(product, user)
    : Promise.resolve(false);
  const isPublished = product.status === "published";
  const isAdmin = user?.role === "admin";

  const [
    canManageProduct,
    isLicensed,
    builds,
    reviewPage,
    dependencyResolution,
    reverseDependencySummary,
    variantGroup,
    gallery,
  ] = await Promise.all([
    managementAccess,
    user
      ? commerceService.checkEntitlement(
          { type: "user", id: user.id },
          product.id,
          "product.download",
        )
      : false,
    managementAccess.then((canManageProduct) => {
      const canInspectBuilds = canManageProduct || isAdmin;
      return productService.getProductBuilds(product.id, canInspectBuilds);
    }),
    isPublished
      ? resourceReviewService.publicPage(product.id).catch((error) => {
          if (error instanceof AppError && error.statusCode === 404) return null;
          throw error;
        })
      : null,
    productService.getDependencyResolution(product).catch(() => null),
    productService.getReverseDependencySummary(product.slug).catch(() => null),
    isPublished ? resourceManagementService.publicVariants(product.id) : null,
    isPublished
      ? resourceMediaRepository.publicItems(product.id)
      : managementAccess.then(async (allowed) =>
          allowed && user ? (await resourceMediaRepository.managed(product.id, user.id)).items : [],
        ),
  ]);
  const hasAccess = isPublished && (canManageProduct || isLicensed || isAdmin);

  const formattedPrice = product.price === 0 ? copy.free : dictionary.checkout.paidUnavailable;

  return (
    <div className="space-y-10">
      {!isPublished && (
        <div className="rounded-xl border border-[color:var(--nexus-warning)]/25 bg-warning-soft p-4 text-sm text-warning">
          <strong>{copy.privatePreview}</strong> · {copy.resourceStatus}:{" "}
          {formatProductStatus(product.status, copy)}. {copy.notPublic}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link href="/market" className="transition-colors hover:text-primary">
          {copy.market}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{dictionary.publishing[PRODUCT_PUBLISHING_KEYS[product.type]]}</span>
        <span aria-hidden="true">/</span>
        <span className="text-secondary">{product.title}</span>
      </div>

      <h1 className="text-3xl font-black tracking-tight text-primary sm:text-4xl">
        {product.title}
      </h1>

      <ResourceVariantChoices group={variantGroup} productId={product.id} locale={locale} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-base bg-inset shadow-nexus-lg">
            <ResourcePreview
              src={product.thumbnailUrl}
              title={product.title}
              fallback={copy.previewUnavailable}
              priority
            />
            <div className="absolute left-4 top-4 flex gap-2">
              <span className="rounded bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-nexus-sm">
                {dictionary.publishing[PRODUCT_PUBLISHING_KEYS[product.type]]}
              </span>
              <span className="rounded border border-white/15 bg-black/70 px-2.5 py-1 font-numeric text-xs font-bold text-white backdrop-blur">
                v{product.currentVersion}
              </span>
            </div>
          </div>

          <ResourceGallery items={gallery} title={product.title} locale={locale} />

          <section className="nexus-panel space-y-4 p-6">
            <h2 className="border-b border-base pb-3 text-base font-bold text-primary">
              {copy.overview}
            </h2>
            <div className="whitespace-pre-line text-sm leading-relaxed text-secondary">
              {product.description}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-base pt-4">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-base bg-inset px-2.5 py-1 text-xs text-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </section>

          <section className="nexus-panel space-y-4 p-6">
            <div className="flex flex-col justify-between gap-2 border-b border-base pb-3 sm:flex-row sm:items-center">
              <h2 className="flex items-center gap-2 text-base font-bold text-primary">
                <Layers className="h-4 w-4 text-accent" aria-hidden="true" />
                <span>{copy.releaseHistory}</span>
              </h2>
              <span className="font-numeric text-[11px] text-faint">{copy.shaRecorded}</span>
            </div>

            <p className="text-xs leading-relaxed text-muted">{copy.latestBuildNotice}</p>
            {isPublished && (
              <Link
                href={releaseHistoryHref(product.slug)}
                className="inline-flex text-xs font-semibold text-accent hover:underline"
              >
                {getReleaseHistoryCopy(locale).browse}
              </Link>
            )}

            {builds.length > 0 ? (
              <div className="space-y-4">
                {builds.map((build) => (
                  <article
                    key={build.id}
                    className="space-y-3 rounded-lg border border-base bg-inset p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-primary">
                          {copy.version} {build.version}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            build.status === "published"
                              ? "bg-success-soft text-success"
                              : build.status === "rejected"
                                ? "bg-danger-soft text-danger"
                                : "bg-warning-soft text-warning"
                          }`}
                        >
                          {formatBuildStatus(build.status, copy)}
                        </span>
                      </div>
                      <span className="font-numeric text-[11px] text-faint">
                        SHA-256: {build.sha256Hash.slice(0, 16)}…
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1 text-[11px] text-muted sm:grid-cols-3">
                      <span className="truncate" title={build.fileName}>
                        {copy.file}: {build.fileName}
                      </span>
                      <span>
                        {copy.size}: {formatFileSize(build.fileSizeBytes)}
                      </span>
                      <span>
                        MTA:{" "}
                        {build.mtaVersionTarget ? `>= ${build.mtaVersionTarget}` : copy.notDeclared}
                      </span>
                      <span>{build.isSigned ? copy.signaturePresent : copy.signatureMissing}</span>
                      <span>{formatScanStatus(build.scanStatus, copy)}</span>
                    </div>

                    <BuildProvenanceDetails
                      build={{
                        id: build.id,
                        version: build.version,
                        status: build.status,
                        sha256Hash: build.sha256Hash,
                        fileName: build.fileName,
                        fileSizeBytes: build.fileSizeBytes,
                        mimeType: build.mimeType,
                        scanStatus: build.scanStatus,
                        scanner: build.scanner,
                        scannedAt: build.scannedAt,
                        mtaVersionTarget: build.mtaVersionTarget,
                        isSigned: build.isSigned,
                      }}
                      locale={locale}
                    />

                    {build.releaseNotes && (
                      <div className="whitespace-pre-line rounded border border-base bg-surface p-2.5 font-mono text-xs text-secondary">
                        {build.releaseNotes}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-faint">{copy.noBuilds}</p>
            )}
          </section>

          <section className="nexus-panel space-y-4 p-6">
            <h2 className="border-b border-base pb-3 text-base font-bold text-primary">
              {copy.usedBy}
            </h2>
            <ReverseDependencyList summary={reverseDependencySummary} locale={locale} />
          </section>

          <section className="nexus-panel space-y-4 p-6">
            <h2 className="flex items-center gap-2 border-b border-base pb-3 text-base font-bold text-primary">
              <MessageSquare className="h-4 w-4 text-warning" aria-hidden="true" />
              <span>{copy.reviews}</span>
            </h2>

            {reviewPage ? (
              <ResourceReviewList
                reviews={reviewPage.reviews}
                productId={product.id}
                authenticated={!!user}
                locale={locale}
              />
            ) : (
              <p className="text-xs text-faint">{resourceReviewCopy(locale).unavailable}</p>
            )}
            {reviewPage && (
              <Link
                href={`/market/${encodeURIComponent(product.slug)}/reviews`}
                className="text-sm text-accent underline"
              >
                {resourceReviewCopy(locale).all} ({reviewPage.total})
              </Link>
            )}
            {reviewPage && user && (
              <Link
                href={`/workspace/library/review/${encodeURIComponent(product.id)}`}
                className="ml-4 text-sm text-accent underline"
              >
                {resourceReviewCopy(locale).write}
              </Link>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="nexus-panel sticky top-24 space-y-6 p-6 shadow-nexus-sm">
            <div>
              <div className="text-3xl font-black text-primary">{formattedPrice}</div>
              <div className="mt-1 text-xs text-muted">
                {copy.licenseModel}:{" "}
                <span className="capitalize">{product.licenseModel.replace(/_/g, " ")}</span>
              </div>
            </div>

            <div className="space-y-3 border-t border-base pt-4">
              {hasAccess ? (
                <div className="space-y-3">
                  <div className="space-y-1 rounded-lg border border-[color:var(--nexus-success)]/20 bg-success-soft p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-success">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>{canManageProduct ? copy.managementAccess : copy.inLibrary}</span>
                    </div>
                    <p className="text-[11px] text-muted">{copy.authorized}</p>
                  </div>

                  <ResourceDownloadButton productId={product.id} version={product.currentVersion} />

                  <Link
                    href="/workspace"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-base bg-surface py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
                  >
                    <Key className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.openLibrary}</span>
                  </Link>
                </div>
              ) : isPublished && product.price === 0 ? (
                <div className="space-y-3">
                  <Link
                    href={`/acquire?productId=${product.id}`}
                    className="flex w-full items-center justify-center rounded-lg bg-accent py-3 text-sm font-bold text-white shadow-nexus transition-colors hover:bg-[var(--nexus-accent-hover)]"
                  >
                    {copy.addToLibrary}
                  </Link>
                  <p className="text-center text-[11px] text-faint">{copy.claimRequired}</p>
                  {isPublished && (
                    <AddResourceToCart key={product.id} productId={product.id} signedIn={!!user} />
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-[color:var(--nexus-warning)]/20 bg-warning-soft p-4 text-xs text-warning">
                  {isPublished ? dictionary.checkout.paidDisabled : copy.notPublic}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-base pt-4 text-xs">
              <h4 className="font-label uppercase text-primary">{copy.compatibility}</h4>
              <div className="space-y-2">
                <div className="flex justify-between gap-4 border-b border-base py-1">
                  <span className="text-muted">{copy.mtaVersion}</span>
                  <span className="font-mono text-secondary">
                    {product.compatibility.mtaMinVersion
                      ? `>= ${product.compatibility.mtaMinVersion}`
                      : copy.notDeclared}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-base py-1">
                  <span className="text-muted">{copy.dependencies}</span>
                  <ProductDependencyList
                    declared={product.compatibility.dependencies ?? []}
                    resolution={dependencyResolution}
                    locale={locale}
                  />
                </div>
                <div className="flex justify-between gap-4 border-b border-base py-1">
                  <span className="text-muted">{copy.libraryAdditions}</span>
                  <span className="font-mono text-secondary">{product.salesCount}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-base py-1">
                  <span className="text-muted">{copy.rating}</span>
                  <span className="font-mono text-warning">
                    {(product.ratingAverage / 10).toFixed(1)} / 5.0 ({product.ratingCount})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--nexus-accent)]/20 bg-accent-soft p-3 text-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <div className="text-[11px] leading-relaxed text-secondary">{copy.security}</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
