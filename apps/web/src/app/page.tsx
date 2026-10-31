import { SectionHeader } from "@nexus/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ArticleCard } from "../components/article-card";
import { ProductCard } from "../components/product-card";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { contentService } from "../lib/services/content-service";
import { mtaMasterDirectoryService } from "../lib/services/mta-master-directory-service";
import { productService } from "../lib/services/product-service";

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
  const directoryTone = directory?.isStale
    ? dictionary.home.latestSnapshot
    : directory
      ? dictionary.home.officialDirectory
      : dictionary.home.directoryUnavailable;
  const playersLabel =
    directory && !directory.isStale ? playersOnline.toLocaleString(numberLocale) : "—";
  const serversLabel = directory?.servers.length ?? "—";

  return (
    <div className="space-y-14">
      <section className="relative -mx-4 overflow-hidden sm:-mx-6 lg:-mx-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--nexus-accent-soft),transparent_55%),linear-gradient(180deg,var(--nexus-elevated),var(--nexus-page))]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,var(--nexus-border-strong),transparent)]"
        />
        <div className="relative mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center gap-6 px-6 py-16 sm:px-10 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent motion-safe:animate-[fade-in_500ms_ease-out]">
            {dictionary.home.liveEcosystem}
          </p>
          <h1 className="font-display text-5xl tracking-tight text-primary motion-safe:animate-[fade-in_700ms_ease-out] sm:text-7xl">
            {dictionary.home.brand}
          </h1>
          <p className="max-w-2xl text-lg font-semibold text-primary motion-safe:animate-[fade-in_850ms_ease-out] sm:text-xl">
            {dictionary.home.title}
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-secondary motion-safe:animate-[fade-in_1s_ease-out] sm:text-base">
            {dictionary.home.description}
          </p>
          <div className="flex flex-wrap gap-3 pt-1 motion-safe:animate-[fade-in_1.1s_ease-out]">
            <Link
              href="/servers"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white transition-[transform,opacity] hover:opacity-90 motion-safe:hover:-translate-y-0.5"
            >
              {dictionary.home.exploreServers}
            </Link>
            <Link
              href="/market?maxPrice=0"
              className="rounded-lg border border-base bg-elevated px-5 py-2.5 text-sm font-semibold text-secondary transition-[transform,colors] hover:bg-hover hover:text-primary motion-safe:hover:-translate-y-0.5"
            >
              {dictionary.home.browseResources}
            </Link>
          </div>
        </div>
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
        <p className="mb-4 text-xs text-muted">
          {dictionary.home.playersOnline}: {playersLabel}
          {" · "}
          {dictionary.home.publicServers}: {serversLabel}
          {" · "}
          {directoryTone}
        </p>
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
