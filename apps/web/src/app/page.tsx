import Link from "next/link";
import { productService } from "../lib/services/product-service";
import { serverService } from "../lib/services/server-service";
import { contentService } from "../lib/services/content-service";
import { ProductCard } from "../components/product-card";
import { ServerCard } from "../components/server-card";
import { ArticleCard } from "../components/article-card";
import { SectionHeader, StatCard, TrustBadge } from "@nexus/ui";
import {
  ArrowRight,
  Box,
  Server as ServerIcon,
  Users,
  KeyRound,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featured, popular, servers, articles] = await Promise.all([
    productService.listProducts({ featuredOnly: true }),
    productService.listProducts({ sort: "popular" }),
    serverService.listServers(),
    contentService.listArticles(),
  ]);

  const totalOnlinePlayers = servers.reduce((acc, s) => acc + s.currentPlayers, 0);

  return (
    <div className="space-y-10">
      {/* Featured Nexus panel — visually distinct from organic content (TASK-010) */}
      {featured.length > 0 && (
        <section>
          <div className="nexus-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <TrustBadge variant="featured" />
              <Link
                href="/market"
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                <span>Browse all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featured.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ecosystem metrics strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Players Online"
          value={totalOnlinePlayers.toLocaleString()}
          tone="success"
          icon={<Users className="w-4 h-4" />}
          context="across connected servers"
        />
        <StatCard
          label="Active Servers"
          value={servers.length}
          tone="accent"
          icon={<ServerIcon className="w-4 h-4" />}
          context="live telemetry"
        />
        <StatCard
          label="Marketplace Items"
          value={popular.length}
          icon={<Box className="w-4 h-4" />}
          context="scripts, models, UI"
        />
        <StatCard
          label="Licenses Issued"
          value={popular.reduce((acc, p) => acc + p.salesCount, 0)}
          tone="purple"
          icon={<KeyRound className="w-4 h-4" />}
          context="cryptographic keys"
        />
      </section>

      {/* Marketplace */}
      <section>
        <SectionHeader
          title="Marketplace"
          description="Verified scripts, vehicle packs, maps and UI modules"
          action={
            <Link
              href="/market"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {popular.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Servers */}
      <section>
        <SectionHeader
          title="Live Servers"
          description="Real-time multiplayer communities on the Nexus network"
          action={
            <Link
              href="/servers"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>Server directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {servers.slice(0, 3).map((s) => (
            <ServerCard key={s.id} server={s} />
          ))}
        </div>
      </section>

      {/* Community / Articles */}
      <section>
        <SectionHeader
          title="Community & Articles"
          description="Technical guides, devlogs and ecosystem news"
          action={
            <Link
              href="/articles"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>All articles</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {articles.slice(0, 2).map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
