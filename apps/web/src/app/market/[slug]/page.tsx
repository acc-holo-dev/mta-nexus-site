import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { productService } from "../../../lib/services/product-service";
import { contentService } from "../../../lib/services/content-service";
import { authService } from "../../../lib/services/auth-service";
import { commerceService } from "../../../lib/services/commerce-service";
import { BuildProvenanceDetails } from "../../../components/build-provenance-details";
import { ProductDependencyList } from "../../../components/product-dependency-list";
import { ReverseDependencyList } from "../../../components/reverse-dependency-list";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import {
  Star,
  Download,
  ShieldCheck,
  CheckCircle2,
  Box,
  FileCode,
  Layers,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Key,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const product = await productService.getProductBySlug(slug);

  if (!product) {
    return { title: dictionary.product.notFound };
  }

  return {
    title: product.title,
    description:
      product.shortDescription ||
      product.description.slice(0, 155),
    alternates: { canonical: `/market/${product.slug}` },
    openGraph: {
      title: product.title,
      description: product.shortDescription || product.description.slice(0, 155),
      type: "website",
      images: product.thumbnailUrl ? [{ url: product.thumbnailUrl }] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.product;
  const cookieStore = await cookies();
  const token = cookieStore.get("nexus_session")?.value;
  const user = await authService.getSession(token);
  const product = await productService.getProductPreviewBySlug(slug, user);

  if (!product) {
    notFound();
  }

  const canManageProduct = user
    ? await productService.canManageProduct(product, user)
    : false;
  const isPublished = product.status === "published";
  const isLicensed = user
    ? await commerceService.checkEntitlement(
        { type: "user", id: user.id },
        product.id,
        "product.download"
      )
    : false;

  const isAdmin = user?.role === "admin";
  const hasAccess =
    isPublished && (canManageProduct || isLicensed || isAdmin);
  const canInspectBuilds = canManageProduct || isAdmin;

  const [
    builds,
    reviews,
    dependencyResolution,
    reverseDependencySummary,
  ] = await Promise.all([
    productService.getProductBuilds(product.id, canInspectBuilds),
    contentService.getComments({ productId: product.id }),
    productService.getDependencyResolution(product).catch(() => null),
    productService.getReverseDependencySummary(product.slug).catch(() => null),
  ]);

  const formattedPrice = copy.free;

  return (
    <div className="space-y-10">
      {!isPublished && (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-4 text-sm text-amber-200">
          {copy.privatePreview} · resource status: {product.status.replace(/_/g, " ")}. {copy.notPublic}
        </div>
      )}
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Link href="/market" className="hover:text-white">{copy.market}</Link>
        <span>/</span>
        <span className="capitalize">{product.type}</span>
        <span>/</span>
        <span className="text-neutral-200">{product.title}</span>
      </div>

      {/* Main product presentation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gallery & Description */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video w-full rounded-xl bg-neutral-900 border border-base overflow-hidden shadow-2xl">
            {product.thumbnailUrl ? (
              <img
                src={product.thumbnailUrl}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600">
                {copy.previewUnavailable}
              </div>
            )}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-blue-600 text-white shadow">
                {product.type}
              </span>
              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-black/80 text-white backdrop-blur border border-neutral-700">
                v{product.currentVersion}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="p-6 rounded-xl border border-base bg-surface space-y-4">
            <h2 className="text-base font-bold text-white border-b border-base pb-3">
              {copy.overview}
            </h2>
            <div className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-4 border-t border-base">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-md text-xs bg-neutral-900 text-neutral-400 border border-base"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Release History & Builds */}
          <div className="p-6 rounded-xl border border-base bg-surface space-y-4">
            <h2 className="text-base font-bold text-white border-b border-base pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>{copy.releaseHistory}</span>
              </div>
              <span className="text-[11px] text-neutral-500 font-mono">{copy.shaRecorded}</span>
            </h2>

            {builds.length > 0 ? (
              <div className="space-y-4">
                {builds.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-lg bg-neutral-900 border border-base space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-white">{copy.version} {b.version}</span>
                        {canInspectBuilds && b.status !== "published" && (
                          <span className="rounded bg-amber-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                            {b.status.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-500 font-mono text-[11px]">
                          SHA-256: {b.sha256Hash.slice(0, 16)}...
                        </span>
                        {hasAccess && b.status === "published" && (
                          <a
                            href={`/api/products/${product.id}/download`}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold"
                          >
                            <Download className="w-3 h-3" />
                            <span>{copy.download}</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1 text-[11px] text-neutral-400 sm:grid-cols-3">
                      <span className="truncate" title={b.fileName}>{copy.file}: {b.fileName}</span>
                      <span>{copy.size}: {formatFileSize(b.fileSizeBytes)}</span>
                      <span>MTA: {b.mtaVersionTarget ? `>= ${b.mtaVersionTarget}` : copy.notDeclared}</span>
                      <span>{b.isSigned ? copy.signaturePresent : copy.signatureMissing}</span>
                      <span>{formatScanStatus(b.scanStatus, copy)}</span>
                    </div>
                    <BuildProvenanceDetails build={b} />
                    {b.releaseNotes && (
                      <div className="text-xs text-neutral-300 whitespace-pre-line font-mono bg-black/40 p-2.5 rounded border border-neutral-800">
                        {b.releaseNotes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">{copy.noBuilds}</p>
            )}
          </div>

          <div className="p-6 rounded-xl border border-base bg-surface space-y-4">
            <h2 className="text-base font-bold text-white border-b border-base pb-3">
              {copy.usedBy}
            </h2>
            <ReverseDependencyList summary={reverseDependencySummary} />
          </div>

          {/* Customer Reviews */}
          <div className="p-6 rounded-xl border border-base bg-surface space-y-4">
            <h2 className="text-base font-bold text-white border-b border-base pb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <span>{copy.reviews}</span>
            </h2>
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-lg bg-neutral-900 border border-base space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="flex text-amber-400">
                          {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                        {rev.isVerifiedPurchase && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            {copy.verifiedAcquisition}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">{rev.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">{copy.noReviews}</p>
            )}
          </div>
        </div>

        {/* Pricing & Ownership Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-base bg-surface space-y-6 sticky top-24">
            <div>
              <div className="text-3xl font-black text-white">{formattedPrice}</div>
              <div className="text-xs text-neutral-400 mt-1 capitalize">
                {copy.licenseModel}: {product.licenseModel.replace(/_/g, " ")}
              </div>
            </div>

            {/* Ownership / Action Box */}
            <div className="space-y-3 pt-4 border-t border-base">
              {hasAccess ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-emerald-400 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{canManageProduct ? "{copy.managementAccess}" : "{copy.inLibrary}"}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      {copy.authorized}
                    </p>
                  </div>

                  <a
                    href={`/api/products/${product.id}/download`}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{copy.downloadBuild} v{product.currentVersion}</span>
                  </a>

                  <Link
                    href="/workspace"
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-base text-neutral-300 text-xs font-semibold transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{copy.openLibrary}</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href={`/checkout?productId=${product.id}`}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <span>{copy.addToLibrary}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="text-[11px] text-center text-neutral-500">
                    {copy.claimRequired}
                  </p>
                </div>
              )}
            </div>

            {/* Specifications Matrix */}
            <div className="space-y-3 pt-4 border-t border-base text-xs">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                {copy.compatibility}
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">{copy.mtaVersion}</span>
                  <span className="font-mono text-neutral-200">
                    {product.compatibility.mtaMinVersion
                      ? `>= ${product.compatibility.mtaMinVersion}`
                      : copy.notDeclared}
                  </span>
                </div>
                <div className="flex justify-between gap-4 py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">{copy.dependencies}</span>
                  <ProductDependencyList
                    declared={product.compatibility.dependencies ?? []}
                    resolution={dependencyResolution}
                  />
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">{copy.libraryAdditions}</span>
                  <span className="font-mono text-neutral-200">{product.salesCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800">
                  <span className="text-neutral-400">{copy.rating}</span>
                  <span className="font-mono text-amber-400">
                    {(product.ratingAverage / 10).toFixed(1)} / 5.0 ({product.ratingCount})
                  </span>
                </div>
              </div>
            </div>

            {/* Security Guarantee */}
            <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-900/30 flex items-start gap-2.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-neutral-300 text-[11px] leading-relaxed">
                {copy.security}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
