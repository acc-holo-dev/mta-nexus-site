import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { ResourceReviewPager } from "../../../../features/resources/reviews-view";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceReviewCopy, resourceReviewState } from "../../../../lib/resource-review-i18n";
import { resourceReviewPageQuery } from "../../../../lib/resource-review-query";
import { authService } from "../../../../lib/services/auth-service";
import { resourceReviewService } from "../../../../lib/services/resource-review-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-5 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).own} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
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
    dictionary = getDictionary(typedLocale),
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
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
      <section className={pageShellClass}>
        <Link href="/workspace/library" className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.pageUnavailable}
          description={copy.pageUnavailableDescription}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
  return (
    <section className={pageShellClass}>
      <Link href="/workspace/library" className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="min-w-0 break-words font-display">{copy.own}</h1>
      <p className="text-sm text-secondary">{copy.subtitle}</p>
      <Link href="/workspace/review-reports" className={navLinkClass}>
        {copy.reports}
      </Link>
      {result.items.length ? (
        result.items.map((review) => (
          <article key={review.id} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
            <h2 className="min-w-0 break-words">{review.title ?? copy.unavailable}</h2>
            <p>
              {resourceReviewState(typedLocale, review.status)} · {copy.rating}:{" "}
              {review.rating ?? "—"}/5
            </p>
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm">{review.text}</p>
            <Link
              href={`/workspace/library/review/${encodeURIComponent(review.productId)}`}
              className={navLinkClass}
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
              <Link href="/market?maxPrice=0" className={navLinkClass}>
                {workspace.browseResources}
              </Link>
              <Link href="/workspace/review-reports" className={`${navLinkClass} mt-3`}>
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
