import Link from "next/link";
import { productService } from "../lib/services/product-service";
import { serverService } from "../lib/services/server-service";
import { contentService } from "../lib/services/content-service";
import { ProductCard } from "../components/product-card";
import { ServerCard } from "../components/server-card";
import { ArticleCard } from "../components/article-card";
import { ArrowRight, Sparkles, Shield, Cpu, Zap, Box, Server, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await productService.listProducts({ featuredOnly: true });
  const servers = await serverService.listServers();
  const articles = await contentService.listArticles();

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl border border-[#232838] bg-gradient-to-b from-[#11131a] to-[#0d0e14] p-8 md:p-14 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Nexus 1.0 Runtime Platform for Multi Theft Auto</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
          The Universal Engine for MTA Servers, Creators & Players
        </h1>

        <p className="mt-4 text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          Production-grade marketplace, cryptographically verified licensing, unified server telemetry,
          and a modular runtime architecture built for high-performance MTA:SA communities.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/market"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Box className="w-4 h-4" />
            <span>Explore Market</span>
          </Link>
          <Link
            href="/servers"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-[#232838] font-semibold text-sm transition-all"
          >
            <Server className="w-4 h-4" />
            <span>Browse Servers</span>
          </Link>
          <Link
            href="/articles"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-[#232838] font-semibold text-sm transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Developer Guides</span>
          </Link>
        </div>

        {/* Feature badges */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-[#1e2230] pt-8 text-left">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Cryptographic Licensing</div>
              <div className="text-[11px] text-neutral-400">Hardware & server IP bounded entitlements</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Cpu className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Nexus Runtime Module</div>
              <div className="text-[11px] text-neutral-400">Native C++ thread offloading & binary sync</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Double-Entry Ledger</div>
              <div className="text-[11px] text-neutral-400">Strict state machine financial audits</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Box className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">Universal Content Engine</div>
              <div className="text-[11px] text-neutral-400">Event-driven discovery and social feed</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Featured Marketplace Resources</span>
            </h2>
            <p className="text-xs text-neutral-400">Hand-curated, verified high-performance scripts and models</p>
          </div>
          <Link
            href="/market"
            className="flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            <span>View all resources</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Trending Servers */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Live Verified Servers</h2>
            <p className="text-xs text-neutral-400">Popular servers powered by the Nexus ecosystem</p>
          </div>
          <Link
            href="/servers"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
          >
            <span>View all servers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {servers.slice(0, 3).map((s) => (
            <ServerCard key={s.id} server={s} />
          ))}
        </div>
      </section>

      {/* Developer Insights & Articles */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Engineering Articles & Devlogs</h2>
            <p className="text-xs text-neutral-400">Deep dives into MTA optimization, Lua networking, and CEF architectures</p>
          </div>
          <Link
            href="/articles"
            className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            <span>Browse articles</span>
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
