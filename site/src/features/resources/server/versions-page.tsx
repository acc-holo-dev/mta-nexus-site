import { buildRepository } from "@nexus/db";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { unknownMarker } from "../../../lib/i18n/unknown";
import { authService } from "../../../lib/services/accounts/auth-service";
import { commerceService } from "../../../lib/services/commerce/commerce-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { authEntryHref } from "../../shell/auth-return";
import { GuestAuthLinks } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax5xlMid, pageShellStack4 } from "../../shell/page-shell";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import { surfaceBgP4TextSmMuted, surfaceSpace3BorderBPb6 } from "../../shell/surface-shell";
import {
  typeBreakSecondary,
  typeDisplayPrimary,
  typeFlexWrapStartBetweenGap3,
  typeMax2xlSmSecondary,
  typeMinSpace1,
  typePrewrapSmSecondary,
  typeSmSecondary,
  typeXsMuted,
  typeXsSemiboldPrimary,
} from "../../shell/type-shell";
import { BuildPackageSummaryPanel } from "../components/build-package-evidence";
import { BuildProvenanceDetails } from "../components/build-provenance-details";
import { ResourceDownloadButton } from "../components/resource-download-button";
import {
  getReleaseHistoryCopy,
  parseReleaseHistoryPage,
  releaseHistoryHref,
} from "../public-release-history";

function formatBuildSize(bytes: number, locale: Locale): string {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return unknownMarker(locale);
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export async function publicResourceVersionsMetadata(): Promise<Metadata> {
  return {
    title: `${getReleaseHistoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function PublicResourceVersionsPage({
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
      <div className={pageShellMax5xlMid}>
        <header className={surfaceSpace3BorderBPb6}>
          <h1 className={typeDisplayPrimary}>{copy.title}</h1>
          <p className={typeMax2xlSmSecondary}>{copy.intro}</p>
        </header>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={releaseHistoryHref(slug, requestedPage)} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  if (!product) notFound();

  let user: Awaited<ReturnType<typeof authService.getSession>> | null = null;
  let sessionFailed = false;
  try {
    user = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    sessionFailed = true;
  }
  const history = await buildRepository
    .pagePublishedReleases(product.id, requestedPage)
    .catch(() => null);
  const back = `/market/${encodeURIComponent(product.slug)}`;

  if (!history) {
    return (
      <div className={pageShellMax5xlMid}>
        <header className={surfaceSpace3BorderBPb6}>
          <Link href={back} className={linkAccentSmRounded}>
            {copy.back}
          </Link>
          <h1 className={typeDisplayPrimary}>
            {product.title} — {copy.title}
          </h1>
          <p className={typeMax2xlSmSecondary}>{copy.intro}</p>
        </header>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link
              href={releaseHistoryHref(product.slug, requestedPage)}
              className={linkAccentSmRounded}
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
    <div className={pageShellMax5xlMid}>
      <header className={surfaceSpace3BorderBPb6}>
        <Link href={back} className={linkAccentSmRounded}>
          {copy.back}
        </Link>
        <h1 className={typeDisplayPrimary}>
          {product.title} — {copy.title}
        </h1>
        <p className={typeMax2xlSmSecondary}>{copy.intro}</p>
      </header>

      <p role="note" className={surfaceBgP4TextSmMuted}>
        {copy.warning}
      </p>

      {history.releases.length === 0 ? (
        <EmptyState title={copy.noBuilds} description={copy.noBuildsHint} />
      ) : (
        <ol className={pageShellStack4}>
          {history.releases.map((release) => (
            <li key={release.id} className={panelClipSpace4P5}>
              <header className={typeFlexWrapStartBetweenGap3}>
                <div className={typeMinSpace1}>
                  <h2 className="text-base font-semibold text-primary">
                    {copy.version} {release.version}
                  </h2>
                  <p className={typeXsMuted}>
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
                  <dd className="text-secondary">
                    {formatBuildSize(release.fileSizeBytes, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.target}</dt>
                  <dd className="text-secondary">{release.mtaVersionTarget || copy.notDeclared}</dd>
                </div>
                <div>
                  <dt className="text-muted">{copy.scanner}</dt>
                  <dd className={typeBreakSecondary}>{release.scanner}</dd>
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

              <div className={typeMinSpace1}>
                <p className={typeXsMuted}>{copy.checksum}</p>
                <code className="block select-all break-all rounded-md border border-base bg-inset px-3 py-2 text-xs text-secondary">
                  {release.sha256Hash}
                </code>
                <p className={typeXsMuted}>{release.isSigned ? copy.signed : copy.unsigned}</p>
              </div>

              <div className="space-y-2">
                <h3 className={typeXsSemiboldPrimary}>{copy.notes}</h3>
                <p className={typePrewrapSmSecondary}>
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
        <div className={typeSmSecondary}>
          {sessionFailed ? (
            <ErrorState
              id="resource-versions-session-unavailable"
              title={copy.sessionUnavailable}
              description={copy.sessionUnavailableDescription}
              action={
                <Link href={returnPath} className={linkAccentSmRounded}>
                  {dictionary.errors.retry}
                </Link>
              }
            />
          ) : user ? (
            <Link
              href={`/acquire?productId=${encodeURIComponent(product.id)}${
                history.releases[0] ? `&buildId=${encodeURIComponent(history.releases[0].id)}` : ""
              }`}
              className={linkAccentSmRounded}
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
              className={linkAccentSmRounded}
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
              className={linkAccentSmRounded}
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
