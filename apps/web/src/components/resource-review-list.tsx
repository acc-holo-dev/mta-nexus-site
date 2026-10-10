import Link from "next/link";
import type { ResourceReviewView } from "@nexus/domain";
import type { Locale } from "../lib/i18n";
import { resourceReviewCopy } from "../lib/resource-review-i18n";
import { ResourceReviewReportForm } from "./resource-review-controls";
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
    <div className="space-y-4">
      {reviews.length ? (
        reviews.map((review) => (
          <article
            key={review.id}
            id={`review-${review.id}`}
            className="space-y-3 rounded-lg border border-base bg-inset p-4"
          >
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              {review.author && (
                <Link
                  href={`/users/${encodeURIComponent(review.author.username)}`}
                  className="text-accent hover:underline"
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
        <p className="text-sm text-muted">{copy.empty}</p>
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
    <nav aria-label={copy.title} className="flex items-center gap-4 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="text-accent underline">
          {copy.previous}
        </Link>
      )}
      <span>
        {page}/{totalPages}
      </span>
      {page < totalPages && (
        <Link href={href(page + 1)} className="text-accent underline">
          {copy.next}
        </Link>
      )}
    </nav>
  );
}
