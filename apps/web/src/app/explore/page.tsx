import { Compass, Sparkles } from "lucide-react";
import { EmptyState, SectionHeader } from "@nexus/ui";
import { productService } from "../../lib/services/product-service";
import { serverService } from "../../lib/services/server-service";
import { contentService } from "../../lib/services/content-service";
import { ProductCard } from "../../components/product-card";
import { ServerCard } from "../../components/server-card";
import { ArticleCard } from "../../components/article-card";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";
import { matchesMtaEndpoint, mtaMasterDirectoryService } from "../../lib/services/mta-master-directory-service";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.explore;

  const [products, servers, articles, directory] = await Promise.all([
    productService.listProducts({ limit: 8 }),
    serverService.listServers(3),
    contentService.listArticles(6),
    mtaMasterDirectoryService.getDirectory().catch(() => null),
  ]);

  return (
    <div className="space-y-10">
      <div className="border-b border-base pb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-primary sm:text-3xl">
          <Compass className="h-7 w-7 text-accent" aria-hidden="true" />
          <span>{copy.title}</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          {copy.description}
        </p>
      </div>

      <section>
        <SectionHeader
          title={copy.topResources}
          action={<Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />}
        />
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.noResources}
            description={dictionary.market.empty}
          />
        )}
      </section>

      <section>
        <SectionHeader title={copy.activeServers} />
        {servers.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                locale={locale}
                observation={directory?.servers.find((item) => matchesMtaEndpoint(server, item))}
                isStale={directory?.isStale}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.noServers}
            description={dictionary.servers.description}
          />
        )}
      </section>

      <section>
        <SectionHeader title={copy.latestTutorials} />
        {articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                locale={locale}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.noArticles}
            description={dictionary.articles.description}
          />
        )}
      </section>
    </div>
  );
}
