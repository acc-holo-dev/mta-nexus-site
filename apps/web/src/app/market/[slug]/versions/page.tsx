import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { buildRepository } from "@nexus/db";
import { BuildProvenanceDetails } from "../../../../components/build-provenance-details";
import { ResourceDownloadButton } from "../../../../components/resource-download-button";
import { BuildPackageSummaryPanel } from "../../../../components/build-package-evidence";
import { formatHistoryDate } from "../../../../lib/commerce-history-format";
import { getRequestLocale } from "../../../../lib/i18n-server";
import {
  getReleaseHistoryCopy,
  parseReleaseHistoryPage,
  releaseHistoryHref,
} from "../../../../lib/public-release-history";
import { authService } from "../../../../lib/services/auth-service";
import { commerceService } from "../../../../lib/services/commerce-service";
import { productService } from "../../../../lib/services/product-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Release history | MTA NEXUS",
  robots: { index: false, follow: false },
};

function formatBuildSize(bytes: number): string {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export default async function PublicResourceVersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [{ slug }, query, locale, cookieStore] = await Promise.all([
    params,
    searchParams,
    getRequestLocale(),
    cookies(),
  ]);
  // Unlike private publisher history, this selector rejects unpublished,
  // paid closed-beta and missing resources *before* querying build rows.
  const product = await productService.getProductBySlug(slug);
  if (!product) notFound();

  const user = await authService.getSession(cookieStore.get("nexus_session")?.value);
  const [history, canDownload] = await Promise.all([
    buildRepository.pagePublishedReleases(product.id, parseReleaseHistoryPage(query.page)),
    user
      ? user.role === "admin"
        ? Promise.resolve(true)
        : productService
            .canManageProduct(product, user)
            .then(
              async (canManage) =>
                canManage ||
                commerceService.checkEntitlement(
                  { type: "user", id: user.id },
                  product.id,
                  "product.download",
                ),
            )
      : Promise.resolve(false),
  ]);
  const copy = getReleaseHistoryCopy(locale);
  const back = `/market/${encodeURIComponent(product.slug)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-7 py-8">
      <header className="space-y-3 border-b border-base pb-6">
        <Link href={back} className="text-sm text-accent hover:underline">
          {copy.back}
        </Link>
        <h1 className="font-display text-primary">
          {product.title} — {copy.title}
        </h1>
        <p className="max-w-2xl text-sm text-secondary">{copy.intro}</p>
      </header>

      <p role="note" className="rounded-lg border border-base bg-surface p-4 text-sm text-muted">
        {copy.warning}
      </p>

      {history.releases.length === 0 ? (
        <p className="py-10 text-sm text-secondary">{copy.noBuilds}</p>
      ) : (
        <ol className="space-y-4">
          {history.releases.map((release) => (
            <li key={release.id} className="nexus-panel space-y-4 p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-primary">
                    {copy.version} {release.version}
                  </h2>
                  <p className="text-xs text-muted">
                    {copy.released}{" "}
                    <time dateTime={release.createdAt.toISOString()}>
                      {formatHistoryDate(release.createdAt, locale)}
                    </time>
                  </p>
                </div>
                <span className="rounded-md border border-base px-3 py-1 text-xs text-success">
                  {copy.scan}
                </span>
              </header>

              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted">{copy.size}</dt>
                  <dd className="text-secondary">{formatBuildSize(release.fileSizeBytes)}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.target}</dt>
                  <dd className="text-secondary">{release.mtaVersionTarget || copy.notDeclared}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.scanner}</dt>
                  <dd className="break-words text-secondary">{release.scanner}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.released}</dt>
                  <dd className="text-secondary">
                    {release.scannedAt ? (
                      <time dateTime={release.scannedAt.toISOString()}>
                        {formatHistoryDate(release.scannedAt, locale)}
                      </time>
                    ) : (
                      copy.notDeclared
                    )}
                  </dd>
                </div>
              </dl>

              <div className="space-y-1">
                <p className="text-xs text-muted">{copy.checksum}</p>
                <code className="block select-all break-all rounded-md border border-base bg-inset px-3 py-2 text-xs text-secondary">
                  {release.sha256Hash}
                </code>
                <p className="text-xs text-muted">
                  {release.isSigned ? copy.signed : copy.unsigned}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-primary">{copy.notes}</h3>
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {release.releaseNotes?.trim() || copy.noNotes}
                </p>
              </div>

              <BuildPackageSummaryPanel summary={release.packageSummary} locale={locale} />

              <BuildProvenanceDetails
                build={{
                  id: release.id,
                  version: release.version,
                  status: "published",
                  sha256Hash: release.sha256Hash,
                  fileName: release.fileName,
                  fileSizeBytes: release.fileSizeBytes,
                  mimeType: release.mimeType,
                  scanStatus: release.scanStatus,
                  scanner: release.scanner,
                  scannedAt: release.scannedAt,
                  mtaVersionTarget: release.mtaVersionTarget,
                  isSigned: release.isSigned,
                }}
                locale={locale}
              />

              {canDownload && (
                <ResourceDownloadButton
                  productId={product.id}
                  version={release.version}
                  buildId={release.id}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {!canDownload && (
        <div className="text-sm text-secondary">
          {user ? (
            <Link
              href={`/acquire?productId=${encodeURIComponent(product.id)}`}
              className="text-accent underline"
            >
              {copy.acquire}
            </Link>
          ) : (
            <Link href="/auth/login" className="text-accent underline">
              {copy.signIn}
            </Link>
          )}
        </div>
      )}

      {history.totalPages > 1 && (
        <nav aria-label={copy.title} className="flex items-center justify-between gap-4 text-sm">
          {history.page > 1 ? (
            <Link
              className="text-accent underline"
              href={releaseHistoryHref(product.slug, history.page - 1)}
            >
              {copy.previous}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-secondary">
            {copy.page} {history.page} {copy.of} {history.totalPages}
          </span>
          {history.page < history.totalPages ? (
            <Link
              className="text-accent underline"
              href={releaseHistoryHref(product.slug, history.page + 1)}
            >
              {copy.next}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
