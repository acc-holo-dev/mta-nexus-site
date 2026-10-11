import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { LibraryReleaseSelectionControls } from "../../../../../components/library-release-selection-controls";
import { ResourceDownloadButton } from "../../../../../components/resource-download-button";
import { ResourceReleaseWatchControl } from "../../../../../components/resource-release-watch-control";
import { resourceReleaseWatchesCopy } from "../../../../../lib/resource-release-watches-i18n";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryReleaseService } from "../../../../../lib/services/resource-release-control-service";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { getResourceReleaseControlCopy } from "../../../../../lib/resource-release-control-i18n";
import { formatHistoryDate, parseHistoryPage } from "../../../../../lib/commerce-history-format";
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
  const copy = getResourceReleaseControlCopy(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1 className="font-display text-primary">{copy.signInRequired}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </section>
    );
  const result = await libraryReleaseService
    .detail(user, id, Math.min(parseHistoryPage(query.page), 1000))
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 404) notFound();
      throw error;
    });
  const current = result.selection.mode === "fixed" ? result.selected : result.latest;
  const watch = await resourceReleaseWatchesService.detail(user, id).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    throw error;
  });
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/workspace/library/updates" className="text-sm text-accent underline">
        {copy.updates}
      </Link>
      <h1 className="font-display text-primary">{copy.versions}</h1>
      <h2 className="break-words text-xl text-primary">
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
        <ResourceDownloadButton productId={id} version={current.version} buildId={current.id} />
      ) : null}
      <LibraryReleaseSelectionControls
        key={`${id}:${result.selection.revision}`}
        productId={id}
        revision={result.selection.revision}
        mode={result.selection.mode}
        selectedBuildId={result.selection.buildId}
        versions={result.versions.map((version) => ({ id: version.id, version: version.version }))}
      />
      <section className="nexus-panel space-y-3 p-5">
        <h2 className="font-semibold text-primary">{resourceReleaseWatchesCopy(locale).title}</h2>
        <p className="text-sm text-secondary">{resourceReleaseWatchesCopy(locale).note}</p>
        <p className="text-xs text-muted">{resourceReleaseWatchesCopy(locale).pinned}</p>
        <ResourceReleaseWatchControl key={`${id}:${watch.revision}`} watch={watch} available={Boolean(result.latest)} />
        <Link href="/workspace/library/watches" className="inline-block text-sm text-accent underline">{resourceReleaseWatchesCopy(locale).title}</Link>
      </section>
      {result.versions.length ? (
        <ol className="space-y-3">
          {result.versions.map((version) => (
            <li key={version.id} className="nexus-panel space-y-3 p-5">
              <h3 className="font-semibold text-primary">{version.version}</h3>
              <p className="text-xs text-muted">
                {copy.publication}:{" "}
                <time dateTime={version.createdAt.toISOString()}>
                  {formatHistoryDate(version.createdAt, locale)}
                </time>
              </p>
              {version.releaseNotes ? (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {version.releaseNotes}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary">{copy.noVersions}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className="text-accent underline">
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className="text-accent underline">
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
