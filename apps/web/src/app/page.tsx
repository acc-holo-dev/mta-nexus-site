import Link from "next/link";
import { ArrowRight, Box, Radio, Server as ServerIcon, Users } from "lucide-react";
import { SectionHeader, StatCard } from "@nexus/ui";
import { ArticleCard } from "../components/article-card";
import { ProductCard } from "../components/product-card";
import { contentService } from "../lib/services/content-service";
import { mtaMasterDirectoryService } from "../lib/services/mta-master-directory-service";
import { productService } from "../lib/services/product-service";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const [directory, freeResources, articles] = await Promise.all([
    mtaMasterDirectoryService.getDirectory().catch(() => null),
    productService.listProducts({ maxPrice: 0, sort: "popular", limit: 4 }),
    contentService.listArticles(4),
  ]);
  const playersOnline =
    directory?.servers.reduce((total, server) => total + (server.players ?? 0), 0) ?? 0;
  const numberLocale = locale === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="space-y-12">
      <section className="nexus-panel overflow-hidden">
        <div className="max-w-4xl space-y-5 p-7 sm:p-10">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-success">
            <Radio className="h-4 w-4" />
            {dictionary.home.liveEcosystem}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-primary sm:text-5xl">
            {dictionary.home.title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-secondary sm:text-base">
            {dictionary.home.description}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/servers"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              {dictionary.home.exploreServers}
            </Link>
            <Link
              href="/market?maxPrice=0"
              className="rounded-lg border border-base bg-elevated px-5 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary"
            >
              {dictionary.home.browseResources}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={dictionary.home.playersOnline}
          value={directory && !directory.isStale ? playersOnline.toLocaleString(numberLocale) : "—"}
          tone="success"
          icon={<Users className="h-4 w-4" />}
          context={
            directory?.isStale
              ? dictionary.home.latestSnapshot
              : directory
                ? dictionary.home.officialDirectory
                : dictionary.home.directoryUnavailable
          }
        />
        <StatCard
          label={dictionary.home.publicServers}
          value={directory?.servers.length ?? "—"}
          tone="accent"
          icon={<ServerIcon className="h-4 w-4" />}
          context={
            directory?.isStale ? dictionary.home.latestSnapshot : dictionary.home.officialDirectory
          }
        />
        <StatCard
          label={dictionary.home.resourcesShown}
          value={freeResources.length}
          tone="purple"
          icon={<Box className="h-4 w-4" />}
          context={dictionary.home.resourcesContext}
        />
      </section>

      <section>
        <SectionHeader
          title={dictionary.home.networkTitle}
          description={dictionary.home.networkDescription}
          action={
            <Link
              href="/servers"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>{dictionary.home.openDirectory}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {directory ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {directory.servers.slice(0, 6).map((server) => (
              <a
                key={`${server.address}:${server.port}`}
                href={`mtasa://${server.address}:${server.port}`}
                className="nexus-panel p-5 transition-colors hover:border-strong"
              >
                <div className="truncate text-sm font-bold text-primary">
                  {server.name || `${server.address}:${server.port}`}
                </div>
                <div className="mt-1 truncate text-xs text-muted">
                  {[server.gameMode, server.mapName].filter(Boolean).join(" · ") ||
                    `${server.address}:${server.port}`}
                </div>
                <div className="mt-4 text-sm font-semibold text-success">
                  {server.players ?? 0} / {server.maxPlayers ?? "?"} {dictionary.home.players}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-muted">
            {dictionary.home.directoryPanelUnavailable}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title={dictionary.home.resourcesTitle}
          description={dictionary.home.resourcesDescription}
          action={
            <Link
              href="/market?maxPrice=0"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>{dictionary.home.viewAllResources}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {freeResources.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {freeResources.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-muted">
            {dictionary.home.noResources}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title={dictionary.home.updatesTitle}
          description={dictionary.home.updatesDescription}
          action={
            <Link
              href="/articles"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <span>{dictionary.home.allUpdates}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} locale={locale} />
            ))}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-muted">
            {dictionary.home.noUpdates}
          </div>
        )}
      </section>
    </div>
  );
}
