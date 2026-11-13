import type { ResourceReviewView } from "@nexus/domain";
import { EmptyState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../../../lib/i18n";
import { resourceReviewCopy } from "../../../lib/resource-review-i18n";
import { ResourceReviewReportForm } from "../../../components/resource-review-controls";

const actionLinkClass =
  "inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function ResourceReviewList({
  reviews,
  productId,
  authenticated,
  locale,
}: {
  reviews: ResourceReviewView[];
  productId: string;
  authenticated: boolean;
  locale: Locale;
}) {
  const copy = resourceReviewCopy(locale);
  return (
    <div className="min-w-0 space-y-4 overflow-x-clip">
      {reviews.length ? (
        reviews.map((review) => (
          <article
            key={review.id}
            id={`review-${review.id}`}
            className="min-w-0 space-y-3 rounded-lg border border-base bg-inset p-4"
          >
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              {review.author && (
                <Link
                  href={`/users/${encodeURIComponent(review.author.username)}`}
                  className={actionLinkClass}
                >
                  {review.author.displayName || review.author.username}
                </Link>
              )}
              <span>
                {copy.rating}:{" "}
                {review.rating && review.rating >= 1 && review.rating <= 5
                  ? `${review.rating}/5`
                  : "—"}
              </span>
              <time dateTime={new Date(review.createdAt).toISOString()}>
                {new Date(review.createdAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US")}
              </time>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm text-secondary">{review.text}</p>
            <p className="text-xs text-muted">
              {review.accessSource === "entitlement"
                ? copy.entitlement
                : review.accessSource === "license"
                  ? copy.license
                  : copy.legacy}
            </p>
            {authenticated && (
              <ResourceReviewReportForm
                productId={productId}
                reviewId={review.id}
                locale={locale}
              />
            )}
          </article>
        ))
      ) : (
        <EmptyState title={copy.empty} description={copy.emptyHint} />
      )}
    </div>
  );
}
export function ResourceReviewPager({
  base,
  page,
  totalPages,
  locale,
  view,
}: {
  base: string;
  page: number;
  totalPages: number;
  locale: Locale;
  view?: string;
}) {
  const copy = resourceReviewCopy(locale),
    href = (value: number) =>
      `${base}?page=${value}${view ? `&view=${encodeURIComponent(view)}` : ""}`;
  return (
    <nav
      aria-label={copy.title}
      className="flex min-w-0 items-center gap-4 overflow-x-clip text-sm"
    >
      {page > 1 && (
        <Link href={href(page - 1)} className={actionLinkClass}>
          {copy.previous}
        </Link>
      )}
      <span>
        {page}/{totalPages}
      </span>
      {page < totalPages && (
        <Link href={href(page + 1)} className={actionLinkClass}>
          {copy.next}
        </Link>
      )}
    </nav>
  );
}
