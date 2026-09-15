import { productService } from "../../lib/services/product-service";
import { ProductCard } from "../../components/product-card";
import Link from "next/link";
import { ShoppingBag, Filter, ArrowUpDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeType = params.type || "all";
  const activeSort = params.sort || "popular";
  const query = params.q || "";

  const products = await productService.listProducts({
    type: activeType === "all" ? undefined : (activeType as any),
    sort: activeSort as any,
    query,
  });

  const categories = [
    { id: "all", label: "All Items" },
    { id: "script", label: "Scripts" },
    { id: "model", label: "3D Models" },
    { id: "vehicle", label: "Vehicles" },
    { id: "map", label: "Maps" },
    { id: "ui", label: "UI / CEF" },
    { id: "plugin", label: "Plugins" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#232838] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 text-blue-500" />
            <span>MTA Resource Marketplace</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Browse verified scripts, vehicle packs, maps, and CEF interfaces with instant cryptographic licensing.
          </p>
        </div>

        {/* Sell / Submit CTA */}
        <Link
          href="/workspace"
          className="self-start md:self-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors"
        >
          Publish Resource
        </Link>
      </div>

      {/* Filter Tabs & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Categories */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
          {categories.map((c) => {
            const isActive = activeType === c.id;
            return (
              <Link
                key={c.id}
                href={`/market?type=${c.id}&sort=${activeSort}${query ? `&q=${query}` : ""}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold shadow"
                    : "bg-[#11131a] text-neutral-400 hover:text-white border border-[#232838]"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-neutral-400">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort:</span>
          <Link
            href={`/market?type=${activeType}&sort=popular${query ? `&q=${query}` : ""}`}
            className={`hover:text-white ${activeSort === "popular" ? "text-blue-400 font-bold" : ""}`}
          >
            Popular
          </Link>
          <span>•</span>
          <Link
            href={`/market?type=${activeType}&sort=newest${query ? `&q=${query}` : ""}`}
            className={`hover:text-white ${activeSort === "newest" ? "text-blue-400 font-bold" : ""}`}
          >
            Newest
          </Link>
          <span>•</span>
          <Link
            href={`/market?type=${activeType}&sort=rating${query ? `&q=${query}` : ""}`}
            className={`hover:text-white ${activeSort === "rating" ? "text-blue-400 font-bold" : ""}`}
          >
            Rating
          </Link>
        </div>
      </div>

      {/* Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center rounded-xl border border-dashed border-[#232838] bg-[#11131a]/50">
          <p className="text-sm text-neutral-400">No resources found in this category.</p>
        </div>
      )}
    </div>
  );
}
