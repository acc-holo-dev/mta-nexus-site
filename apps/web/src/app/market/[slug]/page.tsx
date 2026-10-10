import { AddResourceToCart } from "../../../components/resource-cart-controls";
import { ResourceDownloadButton } from "../../../components/resource-download-button";
import { ResourcePreview } from "../../../components/resource-preview";
import { safeExternalWebUrl } from "@nexus/validation";
import { PRODUCT_PUBLISHING_KEYS } from "../../../lib/product-type-labels";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Key,
  Layers,
  MessageSquare,
  ShieldCheck,
  Star,
} from "lucide-react";
import { contentService } from "../../../lib/services/content-service";
import { productService } from "../../../lib/services/product-service";
import { authService } from "../../../lib/services/auth-service";
import { commerceService } from "../../../lib/services/commerce-service";
import { BuildProvenanceDetails } from "../../../components/build-provenance-details";
import { ProductDependencyList } from "../../../components/product-dependency-list";
import { ReverseDependencyList } from "../../../components/reverse-dependency-list";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { getReleaseHistoryCopy, releaseHistoryHref } from "../../../lib/public-release-history";

export const dynamic = "force-dynamic";

const REVIEW_STAR_IDS = [1, 2, 3, 4, 5] as const;

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

  const description =
    product.shortDescription || product.description.slice(0, 155);
  const thumbnailUrl = safeExternalWebUrl(product.thumbnailUrl);

  return {
    title: product.title,
    description,
    alternates: { canonical: `/market/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: "website",
      images: thumbnailUrl
        ? [{ url: thumbnailUrl }]
        : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, user] = await Promise.all([
    getRequestLocale(),
    cookies().then(cookieStore => authService.getSession(cookieStore.get("nexus_session")?.value)),
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
    reviews,
    dependencyResolution,
    reverseDependencySummary,
  ] = await Promise.all([
    managementAccess,
    user
      ? commerceService.checkEntitlement(
          { type: "user", id: user.id },
          product.id,
          "product.download",
        )
      : false,
    managementAccess.then(canManageProduct => {
      const canInspectBuilds = canManageProduct || isAdmin;
      return productService.getProductBuilds(product.id, canInspectBuilds);
    }),
    contentService.getComments({ productId: product.id }),
    productService.getDependencyResolution(product).catch(() => null),
    productService
      .getReverseDependencySummary(product.slug)
      .catch(() => null),
  ]);
  const hasAccess =
    isPublished && (canManageProduct || isLicensed || isAdmin);

  const formattedPrice =
    product.price === 0
      ? copy.free
      : dictionary.checkout.paidUnavailable;
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="space-y-10">
      {!isPublished && (
        <div className="rounded-xl border border-[color:var(--nexus-warning)]/25 bg-warning-soft p-4 text-sm text-warning">
          <strong>{copy.privatePreview}</strong> · {copy.resourceStatus}:{" "}
          {formatProductStatus(product.status, copy)}. {copy.notPublic}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link
          href="/market"
          className="transition-colors hover:text-primary"
        >
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-base bg-inset shadow-nexus-lg">
            <ResourcePreview src={product.thumbnailUrl} title={product.title} fallback={copy.previewUnavailable} priority />
            <div className="absolute left-4 top-4 flex gap-2">
              <span className="rounded bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-nexus-sm">
                {dictionary.publishing[PRODUCT_PUBLISHING_KEYS[product.type]]}
              </span>
              <span className="rounded border border-white/15 bg-black/70 px-2.5 py-1 font-numeric text-xs font-bold text-white backdrop-blur">
                v{product.currentVersion}
              </span>
            </div>
          </div>

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
              <span className="font-numeric text-[11px] text-faint">
                {copy.shaRecorded}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-muted">
              {copy.latestBuildNotice}
            </p>
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
                        {build.mtaVersionTarget
                          ? `>= ${build.mtaVersionTarget}`
                          : copy.notDeclared}
                      </span>
                      <span>
                        {build.isSigned
                          ? copy.signaturePresent
                          : copy.signatureMissing}
                      </span>
                      <span>{formatScanStatus(build.scanStatus, copy)}</span>
                    </div>

                    <BuildProvenanceDetails build={build} locale={locale} />

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
            <ReverseDependencyList
              summary={reverseDependencySummary}
              locale={locale}
            />
          </section>

          <section className="nexus-panel space-y-4 p-6">
            <h2 className="flex items-center gap-2 border-b border-base pb-3 text-base font-bold text-primary">
              <MessageSquare
                className="h-4 w-4 text-warning"
                aria-hidden="true"
              />
              <span>{copy.reviews}</span>
            </h2>

            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <article
                    key={review.id}
                    className="space-y-2 rounded-lg border border-base bg-inset p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex text-warning">
                          {REVIEW_STAR_IDS.slice(0, review.rating || 5).map((star) => (
                            <Star
                              key={star}
                              className="h-3.5 w-3.5 fill-current"
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        {review.isVerifiedPurchase && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                            <CheckCircle2
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            {copy.verifiedAcquisition}
                          </span>
                        )}
                      </div>
                      <time
                        dateTime={new Date(review.createdAt).toISOString()}
                        className="font-numeric text-[11px] text-faint"
                      >
                        {new Date(review.createdAt).toLocaleDateString(
                          dateLocale,
                        )}
                      </time>
                    </div>
                    <p className="text-xs leading-relaxed text-secondary">
                      {review.text}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-xs text-faint">{copy.noReviews}</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="nexus-panel sticky top-24 space-y-6 p-6 shadow-nexus-sm">
            <div>
              <div className="text-3xl font-black text-primary">
                {formattedPrice}
              </div>
              <div className="mt-1 text-xs text-muted">
                {copy.licenseModel}:{" "}
                <span className="capitalize">
                  {product.licenseModel.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="space-y-3 border-t border-base pt-4">
              {hasAccess ? (
                <div className="space-y-3">
                  <div className="space-y-1 rounded-lg border border-[color:var(--nexus-success)]/20 bg-success-soft p-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-success">
                      <CheckCircle2
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      <span>
                        {canManageProduct
                          ? copy.managementAccess
                          : copy.inLibrary}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      {copy.authorized}
                    </p>
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
                  <p className="text-center text-[11px] text-faint">
                    {copy.claimRequired}
                  </p>
                  {isPublished && <AddResourceToCart key={product.id} productId={product.id} signedIn={!!user} />}
                </div>
              ) : (
                <div className="rounded-lg border border-[color:var(--nexus-warning)]/20 bg-warning-soft p-4 text-xs text-warning">
                  {isPublished ? dictionary.checkout.paidDisabled : copy.notPublic}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-base pt-4 text-xs">
              <h4 className="font-label uppercase text-primary">
                {copy.compatibility}
              </h4>
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
                  <span className="font-mono text-secondary">
                    {product.salesCount}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-b border-base py-1">
                  <span className="text-muted">{copy.rating}</span>
                  <span className="font-mono text-warning">
                    {(product.ratingAverage / 10).toFixed(1)} / 5.0 (
                    {product.ratingCount})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-[color:var(--nexus-accent)]/20 bg-accent-soft p-3 text-xs">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                aria-hidden="true"
              />
              <div className="text-[11px] leading-relaxed text-secondary">
                {copy.security}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
