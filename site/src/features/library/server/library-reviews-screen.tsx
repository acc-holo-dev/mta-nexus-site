import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { formatUnknown } from "../../../lib/i18n/unknown";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceReviewService } from "../../../lib/services/resources/resource-review-service";
import { resourceReviewCopy, resourceReviewState } from "../../resources/resource-review-i18n";
import { resourceReviewPageQuery } from "../../resources/resource-review-query";
import { ResourceReviewPager } from "../../resources/reviews-view";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xlCompact } from "../../shell/page-shell";
import { panelClipSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeMinBreakDisplay, typeMinBreakWords, typeSmSecondary } from "../../shell/type-shell";
export async function libraryReviewsMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).own} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryReviewsScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, cookieStore, params] = await Promise.all([
    getRequestLocale(),
    cookies(),
    searchParams,
  ]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = resourceReviewCopy(typedLocale),
    workspace = getDictionary(typedLocale).workspace,
    dictionary = getDictionary(typedLocale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={copy.unavailable}
        retryHref={"/workspace/library"}
      />
    );
  }

  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
    else if (value !== undefined) returnParams.append(key, value);
  }
  const returnPath = returnParams.size
    ? `/workspace/library/reviews?${returnParams}`
    : "/workspace/library/reviews";
  if (!actor) {
    return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  }
  const query = resourceReviewPageQuery(params);
  const result = await resourceReviewService.ownPage(actor, query.page).catch(() => null);
  if (!result) {
    return (
      <section className={pageShellMax4xlCompact}>
        <Link href="/workspace/library" className={linkAccentSmRounded}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.pageUnavailable}
          description={copy.pageUnavailableDescription}
          action={
            <Link href={returnPath} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
  return (
    <section className={pageShellMax4xlCompact}>
      <Link href="/workspace/library" className={linkAccentSmRounded}>
        {copy.back}
      </Link>
      <h1 className={typeMinBreakDisplay}>{copy.own}</h1>
      <p className={typeSmSecondary}>{copy.subtitle}</p>
      <Link href="/workspace/review-reports" className={linkAccentSmRounded}>
        {copy.reports}
      </Link>
      {result.items.length ? (
        result.items.map((review) => (
          <article key={review.id} className={panelClipSpace3P5}>
            <h2 className={typeMinBreakWords}>{review.title ?? copy.unavailable}</h2>
            <p>
              {resourceReviewState(typedLocale, review.status)} · {copy.rating}:{" "}
              {formatUnknown(typedLocale, review.rating)}/5
            </p>
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm">{review.text}</p>
            <Link
              href={`/workspace/library/review/${encodeURIComponent(review.productId)}`}
              className={linkAccentSmRounded}
            >
              {copy.write}
            </Link>
          </article>
        ))
      ) : (
        <EmptyState
          title={copy.empty}
          description={copy.ownEmptyHint}
          action={
            <>
              <Link href="/market?maxPrice=0" className={linkAccentSmRounded}>
                {workspace.browseResources}
              </Link>
              <Link href="/workspace/review-reports" className={`${linkAccentSmRounded} mt-3`}>
                {copy.reports}
              </Link>
            </>
          }
        />
      )}
      <ResourceReviewPager
        base="/workspace/library/reviews"
        page={result.page}
        totalPages={result.totalPages}
        locale={typedLocale}
      />
    </section>
  );
}
