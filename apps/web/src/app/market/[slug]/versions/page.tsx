import { buildRepository } from "@nexus/db";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authEntryHref } from "../../../../components/auth-return-path";
import { BuildPackageSummaryPanel } from "../../../../components/build-package-evidence";
import { BuildProvenanceDetails } from "../../../../components/build-provenance-details";
import { GuestAuthLinks } from "../../../../components/guest-auth-links";
import { ResourceDownloadButton } from "../../../../components/resource-download-button";
import { formatHistoryDate } from "../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../lib/i18n";
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

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-7 overflow-x-clip py-8";
const actionLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
  const copy = getReleaseHistoryCopy(locale);
  const dictionary = getDictionary(locale);
  const workspace = dictionary.workspace;
  const requestedPage = parseReleaseHistoryPage(query.page);

  // Unlike private publisher history, this selector rejects unpublished,
  // paid, and missing resources *before* querying build rows.
  let product: Awaited<ReturnType<typeof productService.getProductBySlug>> | null = null;
  try {
    product = await productService.getProductBySlug(slug);
  } catch {
    return (
      <div className={pageShellClass}>
        <header className="space-y-3 border-b border-base pb-6">
          <h1 className="font-display text-primary">{copy.title}</h1>
          <p className="max-w-2xl text-sm text-secondary">{copy.intro}</p>
        </header>
        <ErrorState
          id="market-versions-unavailable"
          title={copy.loadUnavailable}
          action={
            <Link href={releaseHistoryHref(slug, requestedPage)} className={actionLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  if (!product) notFound();

  const user = await authService
    .getSession(cookieStore.get("nexus_session")?.value)
    .catch(() => null);
  const history = await buildRepository
    .pagePublishedReleases(product.id, requestedPage)
    .catch(() => null);
  const back = `/market/${encodeURIComponent(product.slug)}`;

  if (!history) {
    return (
      <div className={pageShellClass}>
        <header className="space-y-3 border-b border-base pb-6">
          <Link href={back} className={actionLinkClass}>
            {copy.back}
          </Link>
          <h1 className="font-display text-primary">
            {product.title} — {copy.title}
          </h1>
          <p className="max-w-2xl text-sm text-secondary">{copy.intro}</p>
        </header>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link
              href={releaseHistoryHref(product.slug, requestedPage)}
              className={actionLinkClass}
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const returnPath = releaseHistoryHref(product.slug, history.page);
  const canDownload = user
    ? user.role === "admin"
      ? true
      : await productService
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
          .catch(() => false)
    : false;

  return (
    <div className={pageShellClass}>
      <header className="space-y-3 border-b border-base pb-6">
        <Link href={back} className={actionLinkClass}>
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
        <EmptyState title={copy.noBuilds} description={copy.noBuildsHint} />
      ) : (
        <ol className="min-w-0 space-y-4 overflow-x-clip">
          {history.releases.map((release) => (
            <li key={release.id} className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
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

              <div className="min-w-0 space-y-1">
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
              className={actionLinkClass}
            >
              {copy.acquire}
            </Link>
          ) : (
            <GuestAuthLinks
              loginHref={authEntryHref("login", returnPath)}
              registerHref={authEntryHref("register", returnPath)}
              signInLabel={copy.signIn}
              createAccountLabel={workspace.createAccount}
            />
          )}
        </div>
      )}

      {history.totalPages > 1 && (
        <nav
          aria-label={copy.title}
          className="flex min-w-0 items-center justify-between gap-4 overflow-x-clip text-sm"
        >
          {history.page > 1 ? (
            <Link
              className={actionLinkClass}
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
              className={actionLinkClass}
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
