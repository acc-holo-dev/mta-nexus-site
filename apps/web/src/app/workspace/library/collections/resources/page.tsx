import {
  AppError,
  LIBRARY_COLLECTION_INVENTORY_FILTERS,
  LIBRARY_COLLECTION_INVENTORY_RELEASE_FILTERS,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryReleaseFollowLatest } from "../../../../../components/library-release-follow-latest";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { ResourceDownloadButton } from "../../../../../components/resource-download-button";
import { ResourceReleaseWatchControl } from "../../../../../components/resource-release-watch-control";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { libraryCollectionInventoryCopy } from "../../../../../lib/library-collection-inventory-i18n";
import {
  collectionInventoryHref,
  libraryCollectionInventoryQuery,
  libraryCollectionInventorySuffix,
} from "../../../../../lib/library-collection-inventory-query";
import {
  libraryCollectionError,
  libraryCollectionsCopy,
} from "../../../../../lib/library-collections-i18n";
import { collectionHref, collectionPageParams } from "../../../../../lib/library-collections-query";
import { getResourceReleaseControlCopy } from "../../../../../lib/resource-release-control-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionInventoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]),
    c = libraryCollectionsCopy(locale),
    v = libraryCollectionInventoryCopy(locale),
    dictionary = getDictionary(locale),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) {
    let returnPath = "/workspace/library/collections/resources";
    try {
      const query = libraryCollectionInventoryQuery(collectionPageParams(raw));
      returnPath = `${returnPath}?${libraryCollectionInventorySuffix(query)}`;
    } catch {
      // Keep the list route when filters are invalid for unsigned visitors.
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  try {
    const query = libraryCollectionInventoryQuery(collectionPageParams(raw));
    const report = await libraryCollectionsService.inventory(actor, query).catch((error) => {
      if (error instanceof AppError) throw error;
      return null;
    });
    if (!report) {
      return (
        <div className={pageShellClass}>
          <Link href={collectionHref()} className={navLinkClass}>
            {c.title}
          </Link>
          <ErrorState
            title={v.loadUnavailable}
            action={
              <Link
                href={`${collectionInventoryHref()}?${libraryCollectionInventorySuffix(query)}`}
                className={navLinkClass}
              >
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const suffix = (page: number) => libraryCollectionInventorySuffix({ ...query, page });
    return (
      <div className={pageShellClass}>
        <nav className="flex flex-wrap gap-4">
          <Link href={collectionHref()} className={navLinkClass}>
            {c.title}
          </Link>
          <Link href="/workspace/library" className={navLinkClass}>
            {c.library}
          </Link>
        </nav>
        <h1>{v.title}</h1>
        <p className="text-secondary">{v.note}</p>
        <p className="text-sm text-secondary">{v.watchNote}</p>
        {report.collectionId ? (
          <nav className="flex flex-wrap gap-4" aria-label={v.collection}>
            <Link
              href={collectionHref(report.collectionId, "releases")}
              className={navLinkClass}
            >
              {v.collectionReleases}
            </Link>
            <Link
              href={collectionHref(report.collectionId, "watches")}
              className={navLinkClass}
            >
              {v.collectionWatches}
            </Link>
          </nav>
        ) : null}
        <search aria-label={v.search}>
          <form
            method="get"
            action={collectionInventoryHref()}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="grid gap-1">
              {v.search}
              <input
                name="q"
                defaultValue={report.q}
                maxLength={80}
                className="min-h-11 rounded border border-base bg-surface p-2"
              />
            </label>
            <label className="grid gap-1">
              {v.status}
              <select
                name="status"
                defaultValue={report.status}
                className="rounded border border-base bg-surface p-2"
              >
                {(["all", "active", "archived"] as const).map((status) => (
                  <option key={status} value={status}>
                    {c[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {v.collection}
              <select
                name="collectionId"
                defaultValue={report.collectionId ?? ""}
                className="rounded border border-base bg-surface p-2"
              >
                <option value="">{c.all}</option>
                {report.collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name} · {c[collection.status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {v.filter}
              <select
                name="filter"
                defaultValue={report.filter}
                className="rounded border border-base bg-surface p-2"
              >
                {LIBRARY_COLLECTION_INVENTORY_FILTERS.map((filter) => (
                  <option key={filter} value={filter}>
                    {v[filter]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              {v.releaseFilter}
              <select
                name="release"
                defaultValue={report.release}
                className="rounded border border-base bg-surface p-2"
              >
                {LIBRARY_COLLECTION_INVENTORY_RELEASE_FILTERS.map((release) => (
                  <option key={release} value={release}>
                    {v.releaseFilters[release]}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" className="min-h-11 px-3">
              {v.apply}
            </Button>
            <Link href={collectionInventoryHref()} className={navLinkClass}>
              {v.clear}
            </Link>
          </form>
        </search>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(["resources", "references", "available", "unavailable", "shared"] as const).map(
            (key) => (
              <div key={key} className="nexus-panel p-3">
                <dt>{v[key]}</dt>
                <dd>{report.counts[key]}</dd>
              </div>
            ),
          )}
        </dl>
        <p className="text-sm text-secondary">{v.countNote}</p>
        <nav aria-label={v.releaseFilter} className="flex flex-wrap gap-4">
          {(["attention", "updates", "pinned", "selection-unavailable", "latest"] as const).map(
            (release) => (
              <Link
                key={release}
                href={`${collectionInventoryHref()}?${libraryCollectionInventorySuffix({ ...query, page: 1, release })}`}
                aria-current={release === report.release ? "page" : undefined}
                className={navLinkClass}
              >
                {v.releaseFilters[release]} (
                {
                  report.releaseCounts[
                    release === "selection-unavailable" ? "selectionUnavailable" : release
                  ]
                }
                )
              </Link>
            ),
          )}
        </nav>
        <p>
          {c.items}: {report.total} ·{" "}
          <time dateTime={report.generatedAt}>{report.generatedAt}</time>
        </p>
        <a
          href={`/api/library/collections/resources/export?${suffix(report.page)}`}
          className={navLinkClass}
        >
          {v.export}
        </a>
        <p className="text-sm text-secondary">{v.snapshotNote}</p>
        {!report.items.length ? (
          <EmptyState
            title={v.empty}
            description={v.emptyHint}
            action={
              <Link href={collectionInventoryHref()} className={navLinkClass}>
                {v.clear}
              </Link>
            }
          />
        ) : null}
        <ol className="space-y-4">
          {report.items.map((item) => {
            const first = item.memberships[0],
              second = item.memberships[1],
              resourceHref = `/workspace/library/${encodeURIComponent(item.productId)}`,
              release = item.available ? item.release : null;
            return (
              <li key={item.productId} className="nexus-panel space-y-3 p-5">
                <h2 className="break-words font-semibold">
                  {item.available ? (item.title ?? c.unavailable) : c.unavailable}
                </h2>
                <code className="block break-all text-xs">{item.productId}</code>
                <p>
                  {item.available ? v.available : v.unavailable} · {v.memberships}:{" "}
                  {item.memberships.length}
                </p>
                {release && (
                  <section
                    className="space-y-2 border-t border-base pt-3"
                    aria-label={v.releaseFilter}
                  >
                    <p className="font-semibold">{v.releaseStates[release.state]}</p>
                    <p>
                      {v.latestVersion}: <span className="break-all">{release.latest.version}</span>
                    </p>
                    <p className="text-xs">
                      {v.preferenceRevision}: {release.revision}
                    </p>
                    {release.effective ? (
                      <>
                        <p>
                          {v.effectiveVersion}:{" "}
                          <span className="break-all">{release.effective.version}</span>
                        </p>
                        {release.canReviewRequirements && (
                          <Link
                            href={`${resourceHref}/requirements?${new URLSearchParams({ previewBuildId: release.effective.buildId })}`}
                            className={navLinkClass}
                          >
                            {v.preparation}
                          </Link>
                        )}
                        {release.effective.buildId !== release.latest.buildId && (
                          <Link
                            href={`${resourceHref}/versions/compare?${new URLSearchParams({ from: release.effective.buildId, to: release.latest.buildId })}`}
                            className={`block ${navLinkClass}`}
                          >
                            {v.compareVersions}
                          </Link>
                        )}
                        <ResourceDownloadButton
                          key={`${item.productId}:${release.effective.buildId}:${release.effective.version}`}
                          productId={item.productId}
                          version={release.effective.version}
                          buildId={release.effective.buildId}
                        />
                        {release.state === "update_available" ? (
                          <LibraryReleaseFollowLatest
                            productId={item.productId}
                            actorId={actor.id}
                            revision={release.revision}
                            mode={release.mode}
                          />
                        ) : null}
                      </>
                    ) : (
                      <ErrorState
                        id="library-collection-resources-selection-missing"
                        title={v.selectionMissing}
                      />
                    )}
                  </section>
                )}
                {item.available ? (
                  <ResourceReleaseWatchControl
                    key={`${item.productId}:${item.watch.revision}:${item.watch.enabled}`}
                    watch={{
                      productId: item.productId,
                      enabled: item.watch.enabled,
                      revision: item.watch.revision,
                      updatedAt: item.watch.updatedAt ? new Date(item.watch.updatedAt) : null,
                    }}
                    available={item.available}
                  />
                ) : null}
                <div className="flex flex-wrap gap-4">
                  {item.slug ? (
                    <Link
                      href={`/market/${encodeURIComponent(item.slug)}`}
                      className={navLinkClass}
                    >
                      {getResourceReleaseControlCopy(locale).open}
                    </Link>
                  ) : null}
                  <Link href={`${resourceHref}/collections`} className={navLinkClass}>
                    {v.manage}
                  </Link>
                  {item.available && (
                    <Link href={`${resourceHref}/versions`} className={navLinkClass}>
                      {c.versions}
                    </Link>
                  )}
                  {first && second && (
                    <Link
                      href={collectionHref(first.id, "compare", { to: second.id })}
                      className={navLinkClass}
                    >
                      {v.compare}
                    </Link>
                  )}
                </div>
                <ul className="space-y-2">
                  {item.memberships.map((membership) => (
                    <li key={membership.id} className="border-t border-base pt-2">
                      <Link
                        href={collectionHref(membership.id)}
                        className={`break-words ${navLinkClass}`}
                      >
                        {membership.name}
                      </Link>{" "}
                      · {c[membership.status]} · {c.revision} {membership.revision}
                      <p className="text-xs">
                        {c.added}: <time dateTime={membership.addedAt}>{membership.addedAt}</time>
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
        {report.totalPages > 1 && (
          <nav aria-label={c.page} className="flex flex-wrap gap-4">
            {report.page > 1 && (
              <Link
                href={`${collectionInventoryHref()}?${suffix(report.page - 1)}`}
                className={navLinkClass}
              >
                {c.previous}
              </Link>
            )}
            <span className="inline-flex min-h-11 items-center">
              {c.page} {report.page} {c.of} {report.totalPages}
            </span>
            {report.page < report.totalPages && (
              <Link
                href={`${collectionInventoryHref()}?${suffix(report.page + 1)}`}
                className={navLinkClass}
              >
                {c.next}
              </Link>
            )}
          </nav>
        )}
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    return (
      <section className={pageShellClass}>
        <ErrorState
          title={libraryCollectionError(locale, error.code)}
          action={
            <Link href={collectionInventoryHref()} className={navLinkClass}>
              {c.reload}
            </Link>
          }
        />
      </section>
    );
  }
}
