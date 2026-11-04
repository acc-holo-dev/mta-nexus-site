import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuildProvenanceDetails } from "../../../../../components/build-provenance-details";
import { LibraryReleaseSelectionControls } from "../../../../../components/library-release-selection-controls";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { ResourceDownloadButton } from "../../../../../components/resource-download-button";
import { ResourceReleaseWatchControl } from "../../../../../components/resource-release-watch-control";
import { formatHistoryDate, parseHistoryPage } from "../../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryCollectionsCopy } from "../../../../../lib/library-collections-i18n";
import { libraryReleaseComparisonCopy } from "../../../../../lib/library-release-comparison-i18n";
import { getResourceReleaseControlCopy } from "../../../../../lib/resource-release-control-i18n";
import { resourceReleaseWatchesCopy } from "../../../../../lib/resource-release-watches-i18n";
import { resourceRequirementsCopy } from "../../../../../lib/resource-requirements-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryReleaseService } from "../../../../../lib/services/resource-release-control-service";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Library release selection | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function LibraryVersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = getResourceReleaseControlCopy(typedLocale),
    dictionary = getDictionary(typedLocale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  const page = Math.min(parseHistoryPage(query.page), 1000);
  const returnPath =
    page > 1
      ? `/workspace/library/${encodeURIComponent(id)}/versions?page=${page}`
      : `/workspace/library/${encodeURIComponent(id)}/versions`;
  if (!user) return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  const result = await libraryReleaseService.detail(user, id, page).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/library/updates" className={navLinkClass}>
          {copy.updates}
        </Link>
        <ErrorState
          title={copy.versionsLoadUnavailable}
          description={copy.versionsLoadUnavailableDescription}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const watch = await resourceReleaseWatchesService.detail(user, id).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  if (!watch) {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/library/updates" className={navLinkClass}>
          {copy.updates}
        </Link>
        <ErrorState
          title={copy.versionsLoadUnavailable}
          description={copy.versionsLoadUnavailableDescription}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const current = result.selection.mode === "fixed" ? result.selected : result.latest;
  const watchesCopy = resourceReleaseWatchesCopy(typedLocale);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/library/updates" className={navLinkClass}>
        {copy.updates}
      </Link>
      <h1 className="min-w-0 break-words font-display text-primary">{copy.versions}</h1>
      <h2 className="min-w-0 break-words text-xl text-primary">
        {result.latest ? (result.product.title ?? copy.privateResource) : copy.privateResource}
      </h2>
      <p role="note" className="text-sm text-secondary">
        {copy.selectNote}
      </p>
      <p role="note" className="text-sm text-secondary">
        {copy.latestNote}
      </p>
      <p className="text-sm text-secondary">
        {result.selection.mode === "fixed" ? copy.selected : copy.latest}:{" "}
        {current?.version ?? copy.unavailable}
      </p>
      {current ? (
        <div className="min-w-0 space-y-3 overflow-x-clip">
          <ResourceDownloadButton
            key={`${id}:${current.id}:${current.version}`}
            productId={id}
            version={current.version}
            buildId={current.id}
          />
          <BuildProvenanceDetails
            build={{
              id: current.id,
              version: current.version,
              status: current.status,
              sha256Hash: current.sha256Hash,
              fileName: current.fileName,
              fileSizeBytes: current.fileSizeBytes,
              mimeType: current.mimeType,
              scanStatus: current.scanStatus,
              scanner: current.scanner,
              scannedAt: current.scannedAt,
              mtaVersionTarget: current.mtaVersionTarget,
              isSigned: current.isSigned,
            }}
            locale={typedLocale}
          />
        </div>
      ) : null}
      <Link
        href={`/workspace/library/${encodeURIComponent(id)}/requirements`}
        className={navLinkClass}
      >
        {resourceRequirementsCopy(typedLocale).title}
      </Link>
      <Link
        href={`/workspace/library/${encodeURIComponent(id)}/collections`}
        className={navLinkClass}
      >
        {libraryCollectionsCopy(typedLocale).resourceCollections}
      </Link>
      <LibraryReleaseSelectionControls
        key={id}
        productId={id}
        revision={result.selection.revision}
        mode={result.selection.mode}
        selectedBuildId={result.selection.buildId}
        versions={result.versions.map((version) => ({
          id: version.id,
          version: version.version,
          sha256Hash: version.sha256Hash,
          fileSizeBytes: version.fileSizeBytes,
        }))}
      />
      <section className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
        <h2 className="font-semibold text-primary">{watchesCopy.title}</h2>
        <p className="text-sm text-secondary">{watchesCopy.note}</p>
        <p className="text-xs text-muted">{watchesCopy.pinned}</p>
        <ResourceReleaseWatchControl
          key={`${id}:${watch.revision}`}
          watch={watch}
          available={Boolean(result.latest)}
        />
        <Link href="/workspace/library/watches" className={navLinkClass}>
          {watchesCopy.title}
        </Link>
      </section>
      {result.versions.length ? (
        <ol className="min-w-0 space-y-3 overflow-x-clip">
          {result.versions.map((version) => (
            <li key={version.id} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
              <h3 className="font-semibold text-primary">{version.version}</h3>
              <p className="text-xs text-muted">
                {copy.publication}:{" "}
                <time dateTime={version.createdAt.toISOString()}>
                  {formatHistoryDate(version.createdAt, typedLocale)}
                </time>
              </p>
              {current && current.id !== version.id && (
                <Link
                  href={`/workspace/library/${encodeURIComponent(id)}/versions/compare?${new URLSearchParams({ from: current.id, to: version.id, returnPage: String(result.page) })}`}
                  className={navLinkClass}
                >
                  {libraryReleaseComparisonCopy(typedLocale).title}
                </Link>
              )}
              {version.releaseNotes ? (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {version.releaseNotes}
                </p>
              ) : null}
              <BuildProvenanceDetails
                build={{
                  id: version.id,
                  version: version.version,
                  status: version.status,
                  sha256Hash: version.sha256Hash,
                  fileName: version.fileName,
                  fileSizeBytes: version.fileSizeBytes,
                  mimeType: version.mimeType,
                  scanStatus: version.scanStatus,
                  scanner: version.scanner,
                  scannedAt: version.scannedAt,
                  mtaVersionTarget: version.mtaVersionTarget,
                  isSigned: version.isSigned,
                }}
                locale={typedLocale}
              />
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title={copy.noVersions} description={copy.noVersionsHint} />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex min-w-0 flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={navLinkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={navLinkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
