import React from "react";
import Link from "next/link";
import { Star, Download, ShieldCheck, Tag } from "lucide-react";
import type { Product } from "@nexus/domain";

export function ProductCard({ product }: { product: Product }) {
  const formattedPrice =
    product.price === 0 ? "Free" : `$${(product.price / 100).toFixed(2)}`;

  return (
    <Link
      href={`/market/${product.slug}`}
      className="group flex flex-col rounded-xl border border-[#232838] bg-[#11131a] hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full bg-neutral-900 overflow-hidden">
        {product.thumbnailUrl ? (
          <img
            src={product.thumbnailUrl}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-600">
            No Image
          </div>
        )}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow">
            {product.type}
          </span>
          {product.isFeatured && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-black shadow">
              Featured
            </span>
          )}
        </div>
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded text-xs font-bold bg-black/80 text-white backdrop-blur-sm border border-neutral-700">
          {formattedPrice}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
          <div className="flex items-center gap-1 text-amber-400 font-medium">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{(product.ratingAverage / 10).toFixed(1)}</span>
            <span className="text-neutral-500">({product.ratingCount})</span>
          </div>
          <div className="flex items-center gap-1 text-neutral-500">
            <Download className="w-3.5 h-3.5" />
            <span>{product.salesCount} sold</span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1 mb-1">
          {product.title}
        </h3>

        <p className="text-xs text-neutral-400 line-clamp-2 mb-3 flex-1">
          {product.shortDescription || product.description}
        </p>

        {/* Tags & Meta */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1e2230] text-[11px] text-neutral-500">
          <div className="flex items-center gap-1.5 truncate">
            <Tag className="w-3 h-3 text-neutral-600" />
            <span className="truncate">{product.tags.slice(0, 3).join(", ")}</span>
          </div>
          <span className="font-mono text-neutral-400">v{product.currentVersion}</span>
        </div>
      </div>
    </Link>
  );
}
