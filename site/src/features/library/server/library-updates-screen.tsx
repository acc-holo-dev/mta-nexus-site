import { LIBRARY_RELEASE_FILTERS } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { libraryReleaseService } from "../../../lib/services/resources/resource-release-control-service";
import { parseHistoryPage } from "../../commerce/commerce-history-format";
import { ResourceDownloadButton } from "../../resources/download";
import { ResourceReleaseWatchControl } from "../../resources/release-watch";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakSemiboldPrimary,
  typeDisplayPrimary,
  typeFlexWrapGap3,
  typeFlexWrapGap4,
  typeGrid2Gap4,
  typeSmSecondary,
} from "../../shell/type-shell";
import { LibraryReleaseFollowLatest } from "../release-follow";
import { getResourceReleaseControlCopy } from "../resource-release-control-i18n";

const filterNavClass =
  "inline-flex min-h-11 items-center rounded-md border border-base px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] aria-[current=page]:bg-accent aria-[current=page]:text-white";

export async function libraryUpdatesMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).updates} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryUpdatesScreen({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[]; page?: string | string[] }>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const copy = getResourceReleaseControlCopy(locale),
    dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/workspace/library/updates?"}
      />
    );
  }

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
        <Link href="/workspace/library" className={linkAccentSm}>
          {copy.library}
        </Link>
        <ErrorState
          title={copy.updatesLoadUnavailable}
          description={copy.updatesLoadUnavailableHint}
          action={
            <Link href={returnPath} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/library" className={linkAccentSm}>
        {copy.library}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.updates}</h1>
      <p role="note" className={typeSmSecondary}>
        {copy.selectNote}
      </p>
      <p role="note" className={typeSmSecondary}>
        {copy.latestNote}
      </p>
      <nav aria-label={copy.updates} className={typeFlexWrapGap3}>
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
        <ul className={typeGrid2Gap4}>
          {result.items.map((item) => {
            const version = item.mode === "fixed" ? item.selectedVersion : item.latestVersion;
            const buildId = item.mode === "fixed" ? item.selectedBuildId : item.latestBuildId;
            const canCompare =
              item.state === "update_available" &&
              Boolean(item.selectedBuildId) &&
              Boolean(item.latestBuildId) &&
              item.selectedBuildId !== item.latestBuildId;
            return (
              <li key={item.productId} className={panelSpace3P5}>
                <h2 className={typeBreakSemiboldPrimary}>
                  {item.state === "unavailable"
                    ? copy.privateResource
                    : (item.title ?? copy.privateResource)}
                </h2>
                <p className={typeSmSecondary}>{copy[item.state]}</p>
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
                <div className={typeFlexWrapGap4}>
                  {item.slug && item.state !== "unavailable" ? (
                    <Link
                      href={`/market/${encodeURIComponent(item.slug)}`}
                      className={linkAccentSm}
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
                      className={linkAccentSm}
                    >
                      {copy.compare}
                    </Link>
                  ) : null}
                  <Link
                    href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                    className={linkAccentSm}
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
              <Link href={href(1, "all")} className={linkAccentSm}>
                {copy.all}
              </Link>
            ) : undefined
          }
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccentSm}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccentSm}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
