import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { serverContentService } from "../../../lib/services/servers/server-content-service";
import { ContentCatalogControls, ContentPageNavigation } from "../../community/catalog-controls";
import {
  contentPageFiltered,
  parseContentPage,
  writerTypes,
} from "../../community/user-platform-contract";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax5xl } from "../../shell/page-shell";
import { panelClipSpace3P4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakDisplayPrimary,
  typeBreakHeadingPrimary,
  typeClamp2SmMuted,
  typeFlexWrapBetweenGap2,
  typeFlexWrapGap4XsMuted,
  typeFlexWrapStartBetweenGap4,
  typeHoverUnderlineAccentFocus,
  typeInlineMinH11AccentCta,
  typeMt2SmMuted,
  typeXsSecondary,
} from "../../shell/type-shell";
import { serverContentId } from "../server-content-api";
import { serverContentCopy } from "../server-content-copy";
import { serverPublicationHistoryCopy } from "../server-publication-history-copy";
import { serverWorkspaceError } from "../server-workspace-copy";
export async function serverPublicationsMetadata(): Promise<Metadata> {
  return {
    title: serverContentCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export async function ServerPublicationsScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = serverContentCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.unavailable}
        retryHref={"/workspace/servers/"}
      />
    );
  }

  const { id } = await params;
  const path = `/workspace/servers/${encodeURIComponent(id)}/content`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={path} />;
  const filters = parseContentPage((await searchParams) ?? {});
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(() => serverContentService.page(serverContentId(id), actor, filters))
    .catch((error: unknown) => {
      failure =
        error instanceof AppError ? serverWorkspaceError(locale, error.code) : copy.unavailable;
      return null;
    });
  return (
    <div className={pageShellMax5xl}>
      <Link href={`/workspace/servers/${encodeURIComponent(id)}`} className={linkAccentSm}>
        {team.back}
      </Link>
      <header className={typeFlexWrapStartBetweenGap4}>
        <div className="min-w-0">
          <h1 className={typeBreakDisplayPrimary}>
            {team.title}
            {result ? `: ${result.server.name}` : ""}
          </h1>
          <p className={typeMt2SmMuted}>{team.description}</p>
          <p className={typeMt2SmMuted}>{team.notice}</p>
        </div>
        {result && (
          <Link href={`${path}/new`} className={typeInlineMinH11AccentCta}>
            {team.new}
          </Link>
        )}
      </header>
      {!result ? (
        <ErrorState
          title={failure}
          description={copy.unavailableHint}
          action={
            <Link href={path} className={linkAccentSm}>
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
                <article key={item.id} className={panelClipSpace3P4}>
                  <div className={typeFlexWrapBetweenGap2}>
                    <h2 className={typeBreakHeadingPrimary}>
                      <Link
                        href={`${path}/${encodeURIComponent(item.id)}`}
                        className={typeHoverUnderlineAccentFocus}
                      >
                        {item.title}
                      </Link>
                    </h2>
                    <span className={typeXsSecondary}>
                      {copy[item.status as "draft" | "published" | "archived"]}
                    </span>
                  </div>
                  <p className={typeClamp2SmMuted}>{item.excerpt}</p>
                  <div className={typeFlexWrapGap4XsMuted}>
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
                      {serverPublicationHistoryCopy(locale).history}
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
