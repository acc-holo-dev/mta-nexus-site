import Link from "next/link";
import { productRepository, serverRepository } from "@nexus/db";
import { ProductCard } from "../../../components/product-card";
import { ServerCard } from "../../../components/server-card";
import { Bookmark, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const [products, servers] = await Promise.all([
    productRepository.list({ featuredOnly: true }),
    serverRepository.listActivePublic(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-base pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
            <Link href="/workspace" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Workspace</span>
            </Link>
            <span>/</span>
            <span className="text-neutral-200">Saved Items</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Bookmark className="w-6 h-6 text-purple-500" />
            <span>Saved & Bookmarked Items</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Quick access to bookmarked scripts, vehicles, and servers you follow.
          </p>
        </div>
      </div>

      {/* Bookmarked Products */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white uppercase tracking-wider">
          Saved Resources
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.slice(0, 2).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Bookmarked Servers */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white uppercase tracking-wider">
          Pinned Servers
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {servers.slice(0, 1).map((s) => (
            <ServerCard key={s.id} server={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
