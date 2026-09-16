import React from "react";
import Link from "next/link";
import { Library, Star, Tag } from "lucide-react";
import type { Product } from "@nexus/domain";

export function ProductCard({ product }: { product: Product }) {
  const formattedPrice = "Free";

  const updatedDate = new Date(product.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      href={`/market/${product.slug}`}
      className="group flex flex-col nexus-panel overflow-hidden hover:border-strong hover:shadow-nexus transition-all"
    >
      {/* Cover */}
      <div className="relative aspect-video w-full bg-inset overflow-hidden">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-caption text-faint">
            No preview
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-accent text-white">
            {product.type}
          </span>
        </div>
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded font-numeric text-xs font-bold bg-black/70 text-white">
          {formattedPrice}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3.5 gap-2">
        <div className="flex items-center justify-between font-caption">
          <div className="flex items-center gap-1 text-warning font-semibold">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span className="font-numeric">{(product.ratingAverage / 10).toFixed(1)}</span>
            <span className="text-faint">({product.ratingCount})</span>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <Library className="w-3 h-3" />
            <span className="font-numeric">{product.salesCount}</span>
          </div>
        </div>

        <h3 className="text-xs font-heading text-primary group-hover:text-accent transition-colors line-clamp-1">
          {product.title}
        </h3>

        <p className="font-caption text-muted line-clamp-2 flex-1">
          {product.shortDescription || product.description}
        </p>

        {/* Decision signals footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-base font-caption text-faint">
          <div className="flex items-center gap-1.5 min-w-0">
            <Tag className="w-3 h-3 shrink-0" />
            <span className="truncate">{product.tags.slice(0, 2).join(", ")}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span>upd {updatedDate}</span>
            <span className="font-numeric">v{product.currentVersion}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
