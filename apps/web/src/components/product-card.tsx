import Link from "next/link";
import { Library, Star, Tag } from "lucide-react";
import type { Product } from "@nexus/domain";
import { getDictionary, type Locale } from "../lib/i18n";
import type { PublicResourceAttribution } from "../lib/public-resource-attribution";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";
import { ResourcePreview } from "./resource-preview";

const cardFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";

function AttributionLine({
  attribution,
  unavailable,
}: {
  attribution?: PublicResourceAttribution | null;
  unavailable: string;
}) {
  const organization = attribution?.organization;
  const author = attribution?.author;

  if (organization) {
    return (
      <Link
        href={`/organizations/${encodeURIComponent(organization.slug)}`}
        className={`truncate text-[11px] font-medium text-accent hover:underline ${cardFocus}`}
      >
        {organization.name}
      </Link>
    );
  }

  if (author) {
    return (
      <Link
        href={author.href}
        className={`truncate text-[11px] font-medium text-accent hover:underline ${cardFocus}`}
      >
        {author.displayName}
      </Link>
    );
  }

  return <span className="truncate text-[11px] text-faint">{unavailable}</span>;
}

export function ProductCard({
  product,
  locale = "en",
  attribution = null,
}: {
  product: Product;
  locale?: Locale;
  attribution?: PublicResourceAttribution | null;
}) {
  const dictionary = getDictionary(locale);
  const market = dictionary.market;
  const productHref = `/market/${product.slug}`;
  const updatedDate = new Date(product.updatedAt).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    { month: "short", day: "numeric" },
  );
  const hasReviews = product.ratingCount > 0;
  const libraryLabel = market.libraryAdditions;

  return (
    <article className="group flex flex-col overflow-hidden nexus-panel transition-all hover:border-strong hover:shadow-nexus">
      <Link
        href={productHref}
        aria-label={product.title}
        className={`relative block aspect-video w-full overflow-hidden bg-inset ${cardFocus}`}
      >
        <ResourcePreview
          src={product.thumbnailUrl}
          title={product.title}
          fallback={market.noPreview}
        />
        <div className="absolute left-2 top-2 flex gap-1.5">
          <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {dictionary.publishing[PRODUCT_PUBLISHING_KEYS[product.type]]}
          </span>
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 font-numeric text-xs font-bold text-white">
          {market.free}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between font-caption">
          <div className="flex min-w-0 items-center gap-1 font-semibold text-warning">
            {hasReviews ? (
              <>
                <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span className="font-numeric">{(product.ratingAverage / 10).toFixed(1)}</span>
                <span className="text-faint">({product.ratingCount})</span>
              </>
            ) : (
              <span className="truncate font-medium text-muted">{market.noReviewsYet}</span>
            )}
          </div>
          <div
            className="flex shrink-0 items-center gap-1 text-muted"
            title={libraryLabel}
            aria-label={`${libraryLabel}: ${product.salesCount}`}
          >
            <Library className="h-3 w-3" aria-hidden="true" />
            <span className="font-numeric">{product.salesCount}</span>
          </div>
        </div>

        <h3 className="line-clamp-1 text-xs font-heading text-primary">
          <Link
            href={productHref}
            className={`transition-colors hover:text-accent ${cardFocus}`}
          >
            {product.title}
          </Link>
        </h3>

        <AttributionLine attribution={attribution} unavailable={market.publisherUnavailable} />

        <p className="line-clamp-2 flex-1 font-caption text-muted">
          {product.shortDescription || product.description}
        </p>

        <div className="flex items-center justify-between border-t border-base pt-2.5 font-caption text-faint">
          <div className="flex min-w-0 items-center gap-1.5">
            <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{product.tags.slice(0, 2).join(", ")}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span>
              {market.updated} {updatedDate}
            </span>
            <span className="font-numeric">v{product.currentVersion}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
