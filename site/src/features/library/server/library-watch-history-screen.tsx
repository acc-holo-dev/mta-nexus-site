import {
  AppError,
  LIBRARY_RELEASE_HISTORY_DAYS,
  RESOURCE_RELEASE_WATCH_HISTORY_SOURCES,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState, Input } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceReleaseWatchesService } from "../../../lib/services/resources/resource-release-watches-service";
import { resourceReleaseWatchHistoryCopy } from "../../resources/resource-release-watch-history-i18n";
import { resourceReleaseWatchHistoryQuery } from "../../resources/resource-release-watch-history-query";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded, linkMinH } from "../../shell/link-shell";
import { pageShellMax5xl, pageShellStack3, pageShellStack4 } from "../../shell/page-shell";
import { panelClipSpace3P5, panelFlexClipWrapEndGap4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  typeBreakAllXsOnly,
  typeFlexMinWrapGap4Sm,
  typeLabelBlockUpperSecondary,
  typeMinBreakDisplay,
  typeMinFlex1,
  typeMinFlex1Space15SmSecondary,
  typeSpace2BorderTPt3,
} from "../../shell/type-shell";
import { collectionPageParams } from "../library-collections-query";

const selectClass =
  "min-h-11 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
export async function libraryWatchHistoryMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReleaseWatchHistoryCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryWatchHistoryScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, raw] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const dictionary = getDictionary(typedLocale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={getDictionary(typedLocale).errors.message}
        retryHref={"/workspace/library/watches/history"}
      />
    );
  }

  if (!actor) {
    let returnPath = "/workspace/library/watches/history";
    try {
      const preview = resourceReleaseWatchHistoryQuery(collectionPageParams(raw));
      returnPath = `${returnPath}?${new URLSearchParams({
        page: String(preview.page),
        days: String(preview.days),
        source: preview.source,
        ...(preview.productId ? { productId: preview.productId } : {}),
      })}`;
    } catch {
      // Keep the history route when filters are invalid for unsigned visitors.
    }
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourceReleaseWatchHistoryQuery>;
  try {
    query = resourceReleaseWatchHistoryQuery(collectionPageParams(raw));
  } catch {
    notFound();
  }
  const retryHref = `/workspace/library/watches/history?${new URLSearchParams({
    page: String(query.page),
    days: String(query.days),
    source: query.source,
    ...(query.productId ? { productId: query.productId } : {}),
  })}`;
  const result = await resourceReleaseWatchesService
    .history(actor, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [400, 403, 404].includes(error.statusCode)) notFound();
      return null;
    });
  const c = resourceReleaseWatchHistoryCopy(typedLocale);
  if (!result) {
    return (
      <div className={pageShellMax5xl}>
        <Link href="/workspace/library/watches" className={linkAccentSmRounded}>
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableDescription}
          action={
            <Link href={retryHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const suffix = (page: number) =>
    new URLSearchParams({
      page: String(page),
      days: String(result.days),
      source: result.source,
      ...(result.productId ? { productId: result.productId } : {}),
    }).toString();
  const href = (page: number) => `/workspace/library/watches/history?${suffix(page)}`;
  const filtered = result.source !== "all" || Boolean(result.productId) || result.days !== 30;
  return (
    <div className={pageShellMax5xl}>
      <Link href="/workspace/library/watches" className={linkAccentSmRounded}>
        {c.back}
      </Link>
      <h1 className={typeMinBreakDisplay}>{c.title}</h1>
      <p className="text-secondary">{c.note}</p>
      <form method="get" className={panelFlexClipWrapEndGap4}>
        <label className={typeMinFlex1Space15SmSecondary}>
          <span className={typeLabelBlockUpperSecondary}>{c.days}</span>
          <select name="days" className={selectClass} defaultValue={result.days}>
            {LIBRARY_RELEASE_HISTORY_DAYS.map((days) => (
              <option key={days} value={days}>
                {days}
              </option>
            ))}
          </select>
        </label>
        <label className={typeMinFlex1Space15SmSecondary}>
          <span className={typeLabelBlockUpperSecondary}>{c.source}</span>
          <select name="source" className={selectClass} defaultValue={result.source}>
            {RESOURCE_RELEASE_WATCH_HISTORY_SOURCES.map((source) => (
              <option key={source} value={source}>
                {c[source]}
              </option>
            ))}
          </select>
        </label>
        <div className={typeMinFlex1}>
          <Input
            name="productId"
            defaultValue={result.productId ?? ""}
            maxLength={160}
            pattern="[A-Za-z0-9_-]+"
            label={c.productId}
          />
        </div>
        <Button type="submit" variant="secondary" size="touch">
          {c.filter}
        </Button>
        <Link href="/workspace/library/watches/history" className={linkAccentSmRounded}>
          {c.clear}
        </Link>
      </form>
      <a
        href={`/api/library/watches/history/export?${suffix(result.page)}`}
        className={linkAccentSmRounded}
      >
        {c.export}
      </a>
      {!result.items.length ? (
        <EmptyState
          title={c.empty}
          description={c.emptyHint}
          action={
            filtered ? (
              <Link href="/workspace/library/watches/history" className={linkAccentSmRounded}>
                {c.clear}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {result.items.length ? (
        <ol className={pageShellStack4}>
          {result.items.map((item) => (
            <li key={item.id} className={panelClipSpace3P5}>
              <h2>{c[item.source]}</h2>
              <p>
                {c.time}: <time dateTime={item.createdAt}>{item.createdAt}</time>
              </p>
              {item.collection && (
                <p className="break-all">
                  {c.collectionId}: {item.collection.id} / {item.collection.revision}
                </p>
              )}
              {item.changes && (
                <ul className={pageShellStack3}>
                  {item.changes.map((change) => (
                    <li key={change.productId} className={typeSpace2BorderTPt3}>
                      {change.currentAvailable && change.currentTitle && (
                        <h3 className="break-words">
                          {c.current}: {change.currentTitle}
                        </h3>
                      )}
                      <code className={typeBreakAllXsOnly}>{change.productId}</code>
                      <p>
                        {change.enabled ? c.enabled : c.disabled} · {c.revision}: {change.revision}
                      </p>
                      <p>
                        {c.currentWatch}:{" "}
                        {change.currentWatch
                          ? change.currentWatch.enabled
                            ? c.enabled
                            : c.disabled
                          : c.noCurrentWatch}
                      </p>
                      {change.currentAvailable && (
                        <Link
                          href={`/workspace/library/${encodeURIComponent(change.productId)}/versions`}
                          className={linkAccentSmRounded}
                        >
                          {c.manage}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : null}
      {result.totalPages > 1 && (
        <nav aria-label={c.page} className={typeFlexMinWrapGap4Sm}>
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={linkAccentSmRounded}>
              {c.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {c.page} {result.page} {c.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href(result.page + 1)} className={linkAccentSmRounded}>
              {c.next}
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
