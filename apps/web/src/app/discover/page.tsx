import Link from "next/link";
import {
  Building2,
  Code2,
  Compass,
  FileText,
  Search,
  Server as ServerIcon,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Avatar, EmptyState } from "@nexus/ui";
import { ProductCard } from "../../components/product-card";
import { ServerCard } from "../../components/server-card";
import { ArticleCard } from "../../components/article-card";
import { authService } from "../../lib/services/auth-service";
import { contentService } from "../../lib/services/content-service";
import { matchesMtaEndpoint, mtaMasterDirectoryService } from "../../lib/services/mta-master-directory-service";
import { organizationService } from "../../lib/services/organization-service";
import { productService } from "../../lib/services/product-service";
import { serverService } from "../../lib/services/server-service";
import {
  DISCOVER_TYPES,
  discoverHref,
  parseDiscoverQuery,
  type DiscoverType,
} from "../../lib/discover-query";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

const ICONS = {
  servers: ServerIcon,
  resources: ShoppingBag,
  creators: Code2,
  organizations: Building2,
  content: FileText,
} satisfies Record<DiscoverType, typeof ServerIcon>;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    q?: string | string[];
  }>;
}) {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.discover;
  const { type, query } = parseDiscoverQuery(await searchParams);

  return (
    <div className="space-y-7">
      <div className="border-b border-base pb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-primary sm:text-3xl">
          <Compass className="h-7 w-7 text-accent" aria-hidden="true" />
          <span>{copy.title}</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          {copy.description}
        </p>
      </div>

      <nav
        aria-label={copy.tabsLabel}
        className="flex items-center gap-1 overflow-x-auto border-b border-base"
      >
        {DISCOVER_TYPES.map((item) => {
          const Icon = ICONS[item];
          const active = item === type;
          return (
            <Link
              key={item}
              href={discoverHref({ type: item, query })}
              aria-current={active ? "page" : undefined}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-primary"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {copy[item]}
            </Link>
          );
        })}
      </nav>

      <search aria-label={copy.searchLabel}>
        <form action="/discover" method="get" className="flex flex-wrap gap-2">
          <input type="hidden" name="type" value={type} />
          <label htmlFor="discover-query" className="sr-only">
            {copy.searchLabel}
          </label>
          <input
            id="discover-query"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query}
            placeholder={copy.searchPlaceholder}
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-base bg-surface px-3 text-sm text-primary placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {copy.searchButton}
          </button>
        </form>
      </search>

      <DiscoverResults type={type} query={query} locale={locale} />
    </div>
  );
}

async function DiscoverResults({
  type,
  query,
  locale,
}: {
  type: DiscoverType;
  query: string;
  locale: "en" | "ru";
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.discover;

  if (type === "resources") {
    const products = await productService.listProducts({
      query: query || undefined,
      sort: query ? "relevance" : "popular",
      limit: 12,
    });
    return products.length > 0 ? (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale} />
        ))}
      </div>
    ) : (
      <EmptyState title={copy.noResources} description={dictionary.market.empty} />
    );
  }

  if (type === "servers") {
    const [servers, directory] = await Promise.all([
      query ? serverService.searchServers(query, 12) : serverService.listServers(12),
      mtaMasterDirectoryService.getDirectory().catch(() => null),
    ]);
    return servers.length > 0 ? (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            locale={locale}
            observation={directory?.servers.find((item) =>
              matchesMtaEndpoint(server, item),
            )}
            isStale={directory?.isStale}
          />
        ))}
      </div>
    ) : (
      <EmptyState title={copy.noServers} description={dictionary.servers.description} />
    );
  }

  if (type === "creators") {
    const creators = query
      ? await authService.searchDevelopers(query, 18)
      : await authService.listDevelopers(18);
    return creators.length > 0 ? (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {creators.map((creator) => (
          <Link
            key={creator.id}
            href={`/developers/${creator.username}`}
            className="group nexus-panel flex items-center gap-4 p-5 transition-all hover:border-strong hover:shadow-nexus"
          >
            <Avatar
              src={creator.avatarUrl || undefined}
              alt={creator.displayName}
              fallback={creator.displayName || creator.username}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm font-bold text-primary group-hover:text-accent">
                  {creator.displayName}
                </h2>
                {creator.isVerified && (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-label={copy.verified} />
                )}
              </div>
              <div className="truncate text-xs text-faint">@{creator.username}</div>
              <p className="mt-2 line-clamp-2 text-xs text-muted">
                {creator.bio || copy.creatorFallback}
              </p>
            </div>
          </Link>
        ))}
      </div>
    ) : (
      <EmptyState title={copy.noCreators} description={dictionary.developers.description} />
    );
  }

  if (type === "organizations") {
    const organizations = query
      ? await organizationService.searchOrganizations(query, 18)
      : await organizationService.listOrganizations(18);
    return organizations.length > 0 ? (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((organization) => (
          <Link
            key={organization.id}
            href={`/organizations/${organization.slug}`}
            className="group nexus-panel flex items-center gap-4 p-5 transition-all hover:border-strong hover:shadow-nexus"
          >
            <Avatar
              src={organization.logoUrl || undefined}
              alt={organization.name}
              fallback={organization.name}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-sm font-bold text-primary group-hover:text-accent">
                  {organization.name}
                </h2>
                {organization.isVerified && (
                  <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-label={copy.verified} />
                )}
              </div>
              <div className="truncate text-xs text-faint">@{organization.slug}</div>
              <p className="mt-2 line-clamp-2 text-xs text-muted">
                {organization.description || copy.organizationFallback}
              </p>
            </div>
          </Link>
        ))}
      </div>
    ) : (
      <EmptyState title={copy.noOrganizations} description={copy.organizationFallback} />
    );
  }

  const articles = query
    ? await contentService.searchArticles(query, 18)
    : await contentService.listArticles(18);
  return articles.length > 0 ? (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} locale={locale} />
      ))}
    </div>
  ) : (
    <EmptyState title={copy.noContent} description={dictionary.articles.description} />
  );
}
