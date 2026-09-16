import { productService } from "../../lib/services/product-service";
import { serverService } from "../../lib/services/server-service";
import { contentService } from "../../lib/services/content-service";
import { ProductCard } from "../../components/product-card";
import { ServerCard } from "../../components/server-card";
import { ArticleCard } from "../../components/article-card";
import { Compass, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const products = await productService.listProducts();
  const servers = await serverService.listServers();
  const articles = await contentService.listArticles();

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="border-b border-base pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <Compass className="w-7 h-7 text-blue-500" />
          <span>Explore the MTA Ecosystem</span>
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Curated index of top-rated scripts, active multiplayer servers, and game development devlogs.
        </p>
      </div>

      {/* Featured Resources */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <h2 className="text-base font-bold text-white uppercase tracking-wider">Top Resources</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Popular Servers */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white uppercase tracking-wider">Active Servers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {servers.slice(0, 3).map((s) => (
            <ServerCard key={s.id} server={s} />
          ))}
        </div>
      </section>

      {/* Latest Articles */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-white uppercase tracking-wider">Latest Tutorials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
