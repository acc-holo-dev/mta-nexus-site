import { LIBRARY_RELEASE_FILTERS } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { LibraryReleaseFollowLatest } from "../../../../components/library-release-follow-latest";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { ResourceDownloadButton } from "../../../../features/resources/download";
import { ResourceReleaseWatchControl } from "../../../../components/resource-release-watch-control";
import { parseHistoryPage } from "../../../../lib/commerce-history-format";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getResourceReleaseControlCopy } from "../../../../lib/resource-release-control-i18n";
import { authService } from "../../../../lib/services/auth-service";
import { libraryReleaseService } from "../../../../lib/services/resource-release-control-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const filterNavClass =
  "inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] aria-[current=page]:bg-accent aria-[current=page]:text-white";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Library updates | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function LibraryUpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[]; page?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getResourceReleaseControlCopy(locale),
    dictionary = getDictionary(locale),
    user = await authService.getSession(store.get("nexus_session")?.value);
  const filter = LIBRARY_RELEASE_FILTERS.find((value) => value === query.filter) ?? "all";
  const page = Math.min(parseHistoryPage(query.page), 1000);
  const returnPath = `/workspace/library/updates?${new URLSearchParams({ filter, page: String(page) })}`;
  if (!user) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const result = await libraryReleaseService.page(user, page, filter).catch(() => null);
  const href = (page: number, value = filter) =>
    `/workspace/library/updates?${new URLSearchParams({ filter: value, page: String(page) })}`;
  if (!result) {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/library" className={navLinkClass}>
          {copy.library}
        </Link>
        <ErrorState
          title={copy.updatesLoadUnavailable}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/library" className={navLinkClass}>
        {copy.library}
      </Link>
      <h1 className="font-display text-primary">{copy.updates}</h1>
      <p role="note" className="text-sm text-secondary">
        {copy.selectNote}
      </p>
      <p role="note" className="text-sm text-secondary">
        {copy.latestNote}
      </p>
      <nav aria-label={copy.updates} className="flex flex-wrap gap-3">
        {LIBRARY_RELEASE_FILTERS.map((value) => (
          <Link
            key={value}
            href={href(1, value)}
            aria-current={filter === value ? "page" : undefined}
            className={filterNavClass}
          >
            {value === "updates" ? copy.update_available : copy[value]} ({result.counts[value]})
          </Link>
        ))}
      </nav>
      {result.items.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.items.map((item) => {
            const version = item.mode === "fixed" ? item.selectedVersion : item.latestVersion;
            const buildId = item.mode === "fixed" ? item.selectedBuildId : item.latestBuildId;
            const canCompare =
              item.state === "update_available" &&
              Boolean(item.selectedBuildId) &&
              Boolean(item.latestBuildId) &&
              item.selectedBuildId !== item.latestBuildId;
            return (
              <li key={item.productId} className="nexus-panel space-y-3 p-5">
                <h2 className="break-words font-semibold text-primary">
                  {item.state === "unavailable"
                    ? copy.privateResource
                    : (item.title ?? copy.privateResource)}
                </h2>
                <p className="text-sm text-secondary">{copy[item.state]}</p>
                {item.latestVersion && item.latestBuildId ? (
                  <p className="text-sm">
                    {copy.latest}: {item.latestVersion}
                  </p>
                ) : null}
                {item.mode === "fixed" && item.selectedVersion ? (
                  <p className="text-sm">
                    {copy.selected}: {item.selectedVersion}
                  </p>
                ) : null}
                {item.state !== "unavailable" &&
                item.state !== "selection_unavailable" &&
                version &&
                buildId ? (
                  <ResourceDownloadButton
                    productId={item.productId}
                    version={version}
                    buildId={buildId}
                  />
                ) : null}
                {item.state === "update_available" ? (
                  <LibraryReleaseFollowLatest
                    productId={item.productId}
                    actorId={user.id}
                    revision={item.revision}
                    mode={item.mode}
                  />
                ) : null}
                <ResourceReleaseWatchControl
                  key={`${item.productId}:${item.watchRevision}:${item.watchEnabled}`}
                  watch={{
                    productId: item.productId,
                    enabled: item.watchEnabled,
                    revision: item.watchRevision,
                    updatedAt: item.watchUpdatedAt,
                  }}
                  available={item.state !== "unavailable"}
                  hasAccess={item.hasAccess !== false}
                />
                <div className="flex flex-wrap gap-4">
                  {item.slug && item.state !== "unavailable" ? (
                    <Link
                      href={`/market/${encodeURIComponent(item.slug)}`}
                      className={navLinkClass}
                    >
                      {copy.open}
                    </Link>
                  ) : null}
                  {canCompare && item.selectedBuildId && item.latestBuildId ? (
                    <Link
                      href={`/workspace/library/${encodeURIComponent(item.productId)}/versions/compare?${new URLSearchParams(
                        {
                          from: item.selectedBuildId,
                          to: item.latestBuildId,
                        },
                      )}`}
                      className={navLinkClass}
                    >
                      {copy.compare}
                    </Link>
                  ) : null}
                  <Link
                    href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                    className={navLinkClass}
                  >
                    {copy.manage}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={result.counts.all === 0 ? copy.emptyInventory : copy.emptyFiltered}
          description={result.counts.all === 0 ? copy.emptyInventoryHint : copy.emptyFilteredHint}
          action={
            filter !== "all" && result.counts.all > 0 ? (
              <Link href={href(1, "all")} className={navLinkClass}>
                {copy.all}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={navLinkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className="inline-flex min-h-11 items-center">
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={navLinkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
