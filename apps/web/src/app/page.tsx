import Link from "next/link";
import { productService } from "../lib/services/product-service";
import { contentService } from "../lib/services/content-service";
import { mtaMasterDirectoryService } from "../lib/services/mta-master-directory-service";
import { ProductCard } from "../components/product-card";
import { ArticleCard } from "../components/article-card";
import { SectionHeader, StatCard } from "@nexus/ui";
import { ArrowRight, Box, Radio, Server as ServerIcon, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [directory, freeResources, articles] = await Promise.all([
    mtaMasterDirectoryService.getDirectory().catch(() => null),
    productService.listProducts({ maxPrice: 0, sort: "popular" }),
    contentService.listArticles(),
  ]);
  const playersOnline = directory?.servers.reduce((total, server) => total + (server.players ?? 0), 0) ?? 0;

  return (
    <div className="space-y-12">
      <section className="nexus-panel overflow-hidden">
        <div className="p-7 sm:p-10 space-y-5 max-w-4xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400"><Radio className="w-4 h-4" />Live MTA ecosystem</div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">What is happening in MTA right now?</h1>
          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">Find public MTA servers from the official directory, follow community updates, and add useful resources without a fake checkout flow.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/servers" className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors">Explore MTA servers</Link>
            <Link href="/market?maxPrice=0" className="px-5 py-2.5 rounded-lg border border-base bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-sm font-semibold transition-colors">Browse free resources</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Players online" value={playersOnline.toLocaleString()} tone="success" icon={<Users className="w-4 h-4" />} context={directory ? "from the official MTA directory" : "directory temporarily unavailable"} />
        <StatCard label="Public servers" value={directory?.servers.length ?? "—"} tone="accent" icon={<ServerIcon className="w-4 h-4" />} context={directory?.isStale ? "latest available snapshot" : "from the official MTA directory"} />
        <StatCard label="Free resources" value={freeResources.length} tone="purple" icon={<Box className="w-4 h-4" />} context="available without payment" />
      </section>

      <section>
        <SectionHeader title="MTA Network" description="The most populated public servers from the official MTA master-list" action={<Link href="/servers" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><span>Open directory</span><ArrowRight className="w-3.5 h-3.5" /></Link>} />
        {directory ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {directory.servers.slice(0, 6).map((server) => (
              <a key={server.address + ":" + server.port} href={"mtasa://" + server.address + ":" + server.port} className="nexus-panel p-5 hover:border-emerald-500/70 transition-colors">
                <div className="text-sm font-bold text-white truncate">{server.name || server.address + ":" + server.port}</div>
                <div className="mt-1 text-xs text-neutral-400 truncate">{[server.gameMode, server.mapName].filter(Boolean).join(" · ") || server.address + ":" + server.port}</div>
                <div className="mt-4 text-sm font-semibold text-emerald-400">{server.players ?? 0} / {server.maxPlayers ?? "?"} players</div>
              </a>
            ))}
          </div>
        ) : <div className="nexus-panel p-8 text-center text-sm text-neutral-400">The official MTA directory is temporarily unavailable.</div>}
      </section>

      <section>
        <SectionHeader title="Free resources" description="Community resources you can add without payment" action={<Link href="/market?maxPrice=0" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><span>View all free resources</span><ArrowRight className="w-3.5 h-3.5" /></Link>} />
        {freeResources.length > 0 ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">{freeResources.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="nexus-panel p-8 text-center text-sm text-neutral-400">The first free resources are being prepared.</div>}
      </section>

      <section>
        <SectionHeader title="Community updates" description="News, guides, and development notes from the MTA ecosystem" action={<Link href="/articles" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><span>All updates</span><ArrowRight className="w-3.5 h-3.5" /></Link>} />
        {articles.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{articles.slice(0, 4).map((article) => <ArticleCard key={article.id} article={article} />)}</div> : <div className="nexus-panel p-8 text-center text-sm text-neutral-400">No community updates have been published yet.</div>}
      </section>
    </div>
  );
}
