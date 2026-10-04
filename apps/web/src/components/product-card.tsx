import Link from "next/link";
import { Library, Star, Tag } from "lucide-react";
import type { Product } from "@nexus/domain";
import { getDictionary, type Locale } from "../lib/i18n";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";
import { ResourcePreview } from "./resource-preview";

export function ProductCard({
  product,
  locale = "en",
}: {
  product: Product;
  locale?: Locale;
}) {
  const dictionary = getDictionary(locale);
  const updatedDate = new Date(product.updatedAt).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    { month: "short", day: "numeric" },
  );

  return (
    <Link
      href={`/market/${product.slug}`}
      className="group flex flex-col overflow-hidden nexus-panel transition-all hover:border-strong hover:shadow-nexus"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-inset">
        <ResourcePreview src={product.thumbnailUrl} title={product.title} fallback={dictionary.market.noPreview} />
        <div className="absolute left-2 top-2 flex gap-1.5">
          <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {dictionary.publishing[PRODUCT_PUBLISHING_KEYS[product.type]]}
          </span>
        </div>
        <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 font-numeric text-xs font-bold text-white">
          {dictionary.market.free}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between font-caption">
          <div className="flex items-center gap-1 font-semibold text-warning">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="font-numeric">
              {(product.ratingAverage / 10).toFixed(1)}
            </span>
            <span className="text-faint">({product.ratingCount})</span>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <Library className="h-3 w-3" />
            <span className="font-numeric">{product.salesCount}</span>
          </div>
        </div>

        <h3 className="line-clamp-1 text-xs font-heading text-primary transition-colors group-hover:text-accent">
          {product.title}
        </h3>

        <p className="line-clamp-2 flex-1 font-caption text-muted">
          {product.shortDescription || product.description}
        </p>

        <div className="flex items-center justify-between border-t border-base pt-2.5 font-caption text-faint">
          <div className="flex min-w-0 items-center gap-1.5">
            <Tag className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {product.tags.slice(0, 2).join(", ")}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span>
              {dictionary.market.updated} {updatedDate}
            </span>
            <span className="font-numeric">v{product.currentVersion}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
