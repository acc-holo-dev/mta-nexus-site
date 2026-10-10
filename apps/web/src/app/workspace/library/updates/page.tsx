import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { LIBRARY_RELEASE_FILTERS } from "@nexus/domain";
import { ResourceDownloadButton } from "../../../../components/resource-download-button";
import { authService } from "../../../../lib/services/auth-service";
import { libraryReleaseService } from "../../../../lib/services/resource-release-control-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getResourceReleaseControlCopy } from "../../../../lib/resource-release-control-i18n";
import { parseHistoryPage } from "../../../../lib/commerce-history-format";
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
  const filter = LIBRARY_RELEASE_FILTERS.find((value) => value === query.filter) ?? "all";
  const result = await libraryReleaseService.page(
    user,
    Math.min(parseHistoryPage(query.page), 1000),
    filter,
  );
  const href = (page: number, value = filter) =>
    `/workspace/library/updates?${new URLSearchParams({ filter: value, page: String(page) })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link href="/workspace/library" className="text-sm text-accent underline">
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
            className="rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
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
                <Link
                  href={`/workspace/library/${encodeURIComponent(item.productId)}/versions`}
                  className="inline-block text-sm text-accent underline"
                >
                  {copy.manage}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-secondary">{copy.empty}</p>
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className="text-accent underline">
              {copy.previous}
            </Link>
          ) : null}
          <span>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className="text-accent underline">
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
