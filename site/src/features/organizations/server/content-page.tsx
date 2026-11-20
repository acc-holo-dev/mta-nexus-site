import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { organizationContentService } from "../../../lib/services/organizations/organization-content-service";
import { ContentCatalogControls, ContentPageNavigation } from "../../community/catalog-controls";
import {
  contentPageFiltered,
  parseContentPage,
  writerTypes,
} from "../../community/user-platform-contract";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeDisplayPrimary,
  typeFlexWrapBetweenGap2,
  typeMt2SmMuted,
  typeXsSecondary,
} from "../../shell/type-shell";
import { organizationContentId } from "../organization-content-api";
import { organizationContentCopy } from "../organization-content-copy";
import { organizationPublicationHistoryCopy } from "../organization-publication-history-copy";
import { organizationError } from "../organization-workspace-copy";
import { organizationReturnPath } from "./organization-return-path";
export async function organizationPublicationsMetadata() {
  return {
    title: organizationContentCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export async function OrganizationPublications({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = organizationContentCopy(locale);
  const { id } = await params;
  const path = `/workspace/organizations/${encodeURIComponent(id)}/content`;
  const query = (await searchParams) ?? {};
  const returnPath = organizationReturnPath(id, "content", query);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={team.title}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const filters = parseContentPage(query);
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(() => organizationContentService.page(organizationContentId(id), actor, filters))
    .catch((error: unknown) => {
      failure =
        error instanceof AppError ? organizationError(locale, error.code) : copy.unavailable;
      return null;
    });
  return (
    <div className={pageShellClass}>
      <Link href={`/workspace/organizations/${encodeURIComponent(id)}`} className={linkAccentSm}>
        {team.back}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={typeDisplayPrimary}>
            {team.title}
            {result ? `: ${result.organization.name}` : ""}
          </h1>
          <p className={typeMt2SmMuted}>{team.description}</p>
          <p className={typeMt2SmMuted}>{team.notice}</p>
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
          title={failure}
          description={copy.unavailableHint}
          action={
            <Link href={returnPath} className={linkAccentSm}>
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
                <article key={item.id} className={panelSpace3P4}>
                  <div className={typeFlexWrapBetweenGap2}>
                    <h2 className="break-words font-heading text-primary">
                      <Link
                        href={`${path}/${encodeURIComponent(item.id)}`}
                        className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                      >
                        {item.title}
                      </Link>
                    </h2>
                    <span className={typeXsSecondary}>
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
                    <Link href={`${path}/${encodeURIComponent(item.id)}`} className={linkAccentSm}>
                      {copy.edit}
                    </Link>
                    <Link
                      href={`${path}/${encodeURIComponent(item.id)}/history`}
                      className={linkAccentSm}
                    >
                      {organizationPublicationHistoryCopy(locale).history}
                    </Link>
                    {item.status === "published" && (
                      <Link
                        href={`/articles/${encodeURIComponent(item.slug)}`}
                        className={linkAccentSm}
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
                  <Link href={path} className={linkAccentSm}>
                    {copy.reset}
                  </Link>
                ) : (
                  <Link href={`${path}/new`} className={linkAccentSm}>
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
