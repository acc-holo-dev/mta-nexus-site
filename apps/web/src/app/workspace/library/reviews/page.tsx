import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { resourceReviewService } from "../../../../lib/services/resource-review-service";
import { resourceReviewCopy, resourceReviewState } from "../../../../lib/resource-review-i18n";
import { resourceReviewPageQuery } from "../../../../lib/resource-review-query";
import { ResourceReviewPager } from "../../../../components/resource-review-list";
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
  const copy = resourceReviewCopy(locale),
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!actor)
    return (
      <Link href="/auth/login" className="text-accent underline">
        {copy.signIn}
      </Link>
    );
  const result = await resourceReviewService.ownPage(actor, resourceReviewPageQuery(params).page);
  return (
    <section className="mx-auto max-w-4xl space-y-5 py-8">
      <Link href="/workspace/library" className="text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display">{copy.own}</h1>
      <p className="text-sm text-secondary">{copy.subtitle}</p>
      <Link href="/workspace/review-reports" className="text-accent underline">
        {copy.reports}
      </Link>
      {result.items.length ? (
        result.items.map((review) => (
          <article key={review.id} className="nexus-panel space-y-3 p-5">
            <h2>{review.title ?? copy.unavailable}</h2>
            <p>
              {resourceReviewState(locale, review.status)} · {copy.rating}: {review.rating ?? "—"}/5
            </p>
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm">{review.text}</p>
            <Link
              href={`/workspace/library/review/${encodeURIComponent(review.productId)}`}
              className="text-accent underline"
            >
              {copy.write}
            </Link>
          </article>
        ))
      ) : (
        <p>{copy.empty}</p>
      )}
      <ResourceReviewPager
        base="/workspace/library/reviews"
        page={result.page}
        totalPages={result.totalPages}
        locale={locale}
      />
    </section>
  );
}
