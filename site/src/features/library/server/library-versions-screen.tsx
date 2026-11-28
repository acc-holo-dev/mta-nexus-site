import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { libraryReleaseService } from "../../../lib/services/resources/resource-release-control-service";
import { resourceReleaseWatchesService } from "../../../lib/services/resources/resource-release-watches-service";
import { formatHistoryDate, parseHistoryPage } from "../../commerce/commerce-history-format";
import { ResourceDownloadButton } from "../../resources/download";
import { BuildProvenanceDetails } from "../../resources/evidence";
import { ResourceReleaseWatchControl } from "../../resources/release-watch";
import { resourceReleaseWatchesCopy } from "../../resources/resource-release-watches-i18n";
import { resourceRequirementsCopy } from "../../resources/resource-requirements-i18n";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded, linkMinH } from "../../shell/link-shell";
import { pageShellMax4xl, pageShellStack3 } from "../../shell/page-shell";
import { panelClipSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeFlexMinWrapGap4Sm,
  typeMinBreakDisplayPrimary,
  typePrewrapSmSecondary,
  typeSemiboldPrimary,
  typeSmSecondary,
  typeXsMuted,
} from "../../shell/type-shell";
import { libraryCollectionsCopy } from "../library-collections-i18n";
import { libraryReleaseComparisonCopy } from "../library-release-comparison-i18n";
import { LibraryReleaseSelectionControls } from "../release-selection";
import { getResourceReleaseControlCopy } from "../resource-release-control-i18n";

export async function libraryVersionsMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).versions} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryVersionsScreen({
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
    dictionary = getDictionary(typedLocale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={copy.unavailable}
        retryHref={"/workspace/library/"}
      />
    );
  }

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
      <div className={pageShellMax4xl}>
        <Link href="/workspace/library/updates" className={linkAccentSmRounded}>
          {copy.updates}
        </Link>
        <ErrorState
          title={copy.versionsLoadUnavailable}
          description={copy.versionsLoadUnavailableDescription}
          action={
            <Link href={returnPath} className={linkAccentSmRounded}>
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
      <div className={pageShellMax4xl}>
        <Link href="/workspace/library/updates" className={linkAccentSmRounded}>
          {copy.updates}
        </Link>
        <ErrorState
          title={copy.versionsLoadUnavailable}
          description={copy.versionsLoadUnavailableDescription}
          action={
            <Link href={returnPath} className={linkAccentSmRounded}>
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
    <div className={pageShellMax4xl}>
      <Link href="/workspace/library/updates" className={linkAccentSmRounded}>
        {copy.updates}
      </Link>
      <h1 className={typeMinBreakDisplayPrimary}>{copy.versions}</h1>
      <h2 className="min-w-0 break-words text-xl text-primary">
        {result.latest ? (result.product.title ?? copy.privateResource) : copy.privateResource}
      </h2>
      {result.latest && result.product.slug ? (
        <Link
          href={`/market/${encodeURIComponent(result.product.slug)}`}
          className={linkAccentSmRounded}
        >
          {copy.open}
        </Link>
      ) : null}
      <p role="note" className={typeSmSecondary}>
        {copy.selectNote}
      </p>
      <p role="note" className={typeSmSecondary}>
        {copy.latestNote}
      </p>
      <p className={typeSmSecondary}>
        {result.selection.mode === "fixed" ? copy.selected : copy.latest}:{" "}
        {current?.version ?? copy.unavailable}
      </p>
      {current ? (
        <div className={pageShellStack3}>
          <ResourceDownloadButton
            key={`${id}:${current.id}:${current.version}`}
            productId={id}
            version={current.version}
            buildId={current.id}
            intent={result.selection.mode === "fixed" ? "selected" : "latest"}
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
        className={linkAccentSmRounded}
      >
        {resourceRequirementsCopy(typedLocale).title}
      </Link>
      <Link
        href={`/workspace/library/${encodeURIComponent(id)}/collections`}
        className={linkAccentSmRounded}
      >
        {libraryCollectionsCopy(typedLocale).resourceCollections}
      </Link>
      <LibraryReleaseSelectionControls
        key={`${user.id}:${id}`}
        productId={id}
        actorId={user.id}
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
      <section className={panelClipSpace3P5}>
        <h2 className={typeSemiboldPrimary}>{watchesCopy.title}</h2>
        <p className={typeSmSecondary}>{watchesCopy.note}</p>
        <p className={typeXsMuted}>{watchesCopy.pinned}</p>
        <ResourceReleaseWatchControl
          key={`${id}:${watch.revision}`}
          watch={watch}
          available={Boolean(result.latest)}
        />
        <Link href="/workspace/library/watches" className={linkAccentSmRounded}>
          {watchesCopy.title}
        </Link>
      </section>
      {result.versions.length ? (
        <ol className={pageShellStack3}>
          {result.versions.map((version) => (
            <li key={version.id} className={panelClipSpace3P5}>
              <h3 className={typeSemiboldPrimary}>{version.version}</h3>
              <p className={typeXsMuted}>
                {copy.publication}:{" "}
                <time dateTime={version.createdAt.toISOString()}>
                  {formatHistoryDate(version.createdAt, typedLocale)}
                </time>
              </p>
              {current && current.id !== version.id && (
                <Link
                  href={`/workspace/library/${encodeURIComponent(id)}/versions/compare?${new URLSearchParams({ from: current.id, to: version.id, returnPage: String(result.page) })}`}
                  className={linkAccentSmRounded}
                >
                  {libraryReleaseComparisonCopy(typedLocale).title}
                </Link>
              )}
              {version.releaseNotes ? (
                <p className={typePrewrapSmSecondary}>{version.releaseNotes}</p>
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
        <nav aria-label={copy.page} className={typeFlexMinWrapGap4Sm}>
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkAccentSmRounded}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkAccentSmRounded}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
