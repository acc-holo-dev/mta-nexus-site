import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  ContentCatalogControls,
  ContentPageNavigation,
} from "../../../../../components/content-catalog-controls";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { organizationContentId } from "../../../../../lib/organization-content-api";
import { organizationContentCopy } from "../../../../../lib/organization-content-copy";
import { organizationPublicationHistoryCopy } from "../../../../../lib/organization-publication-history-copy";
import { authService } from "../../../../../lib/services/auth-service";
import { organizationContentService } from "../../../../../lib/services/organization-content-service";
import {
  contentPageFiltered,
  parseContentPage,
  writerTypes,
} from "../../../../../lib/user-platform-contract";
import { getUserPlatformCopy, userPlatformError } from "../../../../../lib/user-platform-copy";
export const dynamic = "force-dynamic";
const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata() {
  return {
    title: organizationContentCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function OrganizationPublications({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = organizationContentCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  const { id } = await params;
  const path = `/workspace/organizations/${encodeURIComponent(id)}/content`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={path} />;
  const filters = parseContentPage((await searchParams) ?? {});
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(() => organizationContentService.page(organizationContentId(id), actor, filters))
    .catch((error: unknown) => {
      failure =
        error instanceof AppError ? userPlatformError(locale, error.code) : copy.unavailable;
      return null;
    });
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/organizations/${encodeURIComponent(id)}`} className={navLinkClass}>
        {team.back}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-primary">
            {team.title}
            {result ? `: ${result.organization.name}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted">{team.description}</p>
          <p className="mt-2 text-sm text-muted">{team.notice}</p>
        </div>
        {result && (
          <Link
            href={`${path}/new`}
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            {team.new}
          </Link>
        )}
      </header>
      {!result ? (
        <ErrorState
          id="workspace-organization-content-unavailable"
          title={failure}
          action={
            <Link href={path} className={navLinkClass}>
              {copy.retry}
            </Link>
          }
        />
      ) : (
        <>
          <ContentCatalogControls
            path={path}
            filters={filters}
            locale={locale}
            types={writerTypes}
            showStatus
          />
          {result.items.length ? (
            <div className="space-y-3">
              {result.items.map((item) => (
                <article key={item.id} className="nexus-panel space-y-3 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <h2 className="break-words font-heading text-primary">
                      <Link
                        href={`${path}/${encodeURIComponent(item.id)}`}
                        className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                      >
                        {item.title}
                      </Link>
                    </h2>
                    <span className="text-xs text-secondary">
                      {copy[item.status as "draft" | "published" | "archived"]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{item.excerpt}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted">
                    <span>
                      {team.author}: {item.authorName ?? item.authorUsername ?? item.authorId}
                    </span>
                    <time dateTime={item.updatedAt}>
                      {copy.updated}:{" "}
                      {new Date(item.updatedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}
                    </time>
                    <span>
                      {copy.comments}: {item.commentCount}
                    </span>
                    <Link href={`${path}/${encodeURIComponent(item.id)}`} className={navLinkClass}>
                      {copy.edit}
                    </Link>
                    <Link
                      href={`${path}/${encodeURIComponent(item.id)}/history`}
                      className={navLinkClass}
                    >
                      {organizationPublicationHistoryCopy(locale).history}
                    </Link>
                    {item.status === "published" && (
                      <Link
                        href={`/articles/${encodeURIComponent(item.slug)}`}
                        className={navLinkClass}
                      >
                        {copy.publicView}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={contentPageFiltered(filters) ? copy.emptyFiltered : copy.empty}
              description={contentPageFiltered(filters) ? team.emptyFilteredHint : team.emptyHint}
              action={
                contentPageFiltered(filters) ? (
                  <Link href={path} className={navLinkClass}>
                    {copy.reset}
                  </Link>
                ) : (
                  <Link href={`${path}/new`} className={navLinkClass}>
                    {team.new}
                  </Link>
                )
              }
            />
          )}
          <ContentPageNavigation
            path={path}
            filters={filters}
            page={result.page}
            hasMore={result.hasMore}
            locale={locale}
          />
        </>
      )}
    </div>
  );
}
