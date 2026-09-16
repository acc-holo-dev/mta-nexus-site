import Link from "next/link";
import { productService } from "../lib/services/product-service";
import { serverService } from "../lib/services/server-service";
import { contentService } from "../lib/services/content-service";
import { ProductCard } from "../components/product-card";
import { ServerCard } from "../components/server-card";
import { ArticleCard } from "../components/article-card";
import {
  ArrowRight,
  Shield,
  Cpu,
  Zap,
  Box,
  Server as ServerIcon,
  BookOpen,
  Sparkles,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, servers, articles] = await Promise.all([
    productService.listProducts({ featuredOnly: true }),
    serverService.listServers(),
    contentService.listArticles(),
  ]);

  const totalOnlinePlayers = servers.reduce((acc, s) => acc + s.currentPlayers, 0);

  return (
    <div className="space-y-10">
      {/* Compact Dense Nexus Canvas */}
      <section className="rounded-xl border border-[#232838] bg-gradient-to-r from-[#11131a] via-[#0d0f17] to-[#11131a] p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>MTA Nexus 1.2 Public Platform</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Ecosystem Platform for MTA:SA
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              Verified scripts, hardware-bound cryptographic licensing, live server telemetry, and developer network.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="p-3 rounded-lg bg-neutral-900 border border-[#232838] text-center min-w-28">
              <div className="text-xl font-black text-emerald-400 font-mono">
                {totalOnlinePlayers.toLocaleString()}
              </div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                Live Players
              </div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-900 border border-[#232838] text-center min-w-28">
              <div className="text-xl font-black text-blue-400 font-mono">
                {servers.length}
              </div>
              <div className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                Online Servers
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons & Fast Links */}
        <div className="mt-6 pt-5 border-t border-[#1e2230] flex flex-wrap items-center gap-3">
          <Link
            href="/market"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all"
          >
            <Box className="w-4 h-4" />
            <span>Marketplace</span>
          </Link>
          <Link
            href="/servers"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-[#232838] font-semibold text-xs transition-colors"
          >
            <ServerIcon className="w-4 h-4" />
            <span>Server Hub</span>
          </Link>
          <Link
            href="/explore"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-[#232838] font-semibold text-xs transition-colors"
          >
            <span>Explore Index</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Featured Marketplace Resources */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Featured Marketplace Releases
            </h2>
            <p className="text-[11px] text-neutral-400">
              Verified scripts, vehicle packs, and UI modules with cryptographic entitlement
            </p>
          </div>
          <Link
            href="/market"
            className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            <span>Browse All ({products.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Live Verified Game Servers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Active Server Telemetry
            </h2>
            <p className="text-[11px] text-neutral-400">
              Real-time multiplayer servers connected to the MTA Nexus network
            </p>
          </div>
          <Link
            href="/servers"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <span>View All Servers ({servers.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {servers.slice(0, 3).map((s) => (
            <ServerCard key={s.id} server={s} />
          ))}
        </div>
      </section>

      {/* Engineering Insights & Articles */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#232838] pb-3">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Knowledge Base & Devlogs
            </h2>
            <p className="text-[11px] text-neutral-400">
              Technical guides on high-load networking, CEF UI patterns, and MTA architecture
            </p>
          </div>
          <Link
            href="/articles"
            className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            <span>All Articles ({articles.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.slice(0, 2).map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
