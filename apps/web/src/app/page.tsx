import { buttonClassName, SectionHeader } from "@nexus/ui";
import { ArrowRight } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArticleCard } from "../components/article-card";
import { HomePersonalChangesPanel } from "../components/home-personal-changes-panel";
import { ProductCard } from "../components/product-card";
import { HomeNetworkServerCard } from "../components/server-card";
import { loadPersonalChangesSummary } from "../lib/home-personal-changes";
import { HOME_PERSONAL_COOKIE, parseHomePersonalPreference } from "../lib/home-personal-preference";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { contentService } from "../lib/services/content-service";
import {
  type MtaMasterServer,
  matchesMtaEndpoint,
  mtaMasterDirectoryService,
} from "../lib/services/mta-master-directory-service";
import { productService } from "../lib/services/product-service";
import { serverService } from "../lib/services/server-service";

export const dynamic = "force-dynamic";

function summarizeKnownPlayers(servers: readonly MtaMasterServer[]) {
  let sum = 0;
  let known = 0;
  let unknown = 0;
  for (const server of servers) {
    if (server.players == null) {
      unknown += 1;
      continue;
    }
    known += 1;
    sum += server.players;
  }
  return { sum, known, unknown, total: servers.length };
}

export default async function HomePage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const cookieStore = await cookies();
  const session = await authService
    .getSession(cookieStore.get("nexus_session")?.value)
    .catch(() => null);
  const personalPreference = parseHomePersonalPreference(
    cookieStore.get(HOME_PERSONAL_COOKIE)?.value,
  );
  const [directory, freeResources, articles, nexusListings, personalSummary] = await Promise.all([
    mtaMasterDirectoryService.getDirectory().catch(() => null),
    productService.listProducts({ maxPrice: 0, sort: "popular", limit: 4 }),
    contentService.listArticles(4),
    serverService.listServers(200).catch(() => []),
    session
      ? loadPersonalChangesSummary(session.id, locale, personalPreference === "hide").catch(() => ({
          status: "error" as const,
          items: [],
          failedSources: [
            "releaseWatch" as const,
            "discussionFollow" as const,
            "replyToMe" as const,
          ],
        }))
      : Promise.resolve(null),
  ]);
  const resourceAttributions = await productService.getPublicAttributions(freeResources);
  const playerSummary = directory ? summarizeKnownPlayers(directory.servers) : null;
  const numberLocale = locale === "ru" ? "ru-RU" : "en-US";
  const directoryTone = directory?.isStale
    ? dictionary.home.latestSnapshot
    : directory
      ? dictionary.home.officialDirectory
      : dictionary.home.directoryUnavailable;
  const playersPartial = Boolean(
    directory && !directory.isStale && playerSummary && playerSummary.unknown > 0,
  );
  const playersLabel =
    !directory || directory.isStale || !playerSummary
      ? "—"
      : playerSummary.known === 0
        ? dictionary.servers.playersUnknown
        : playersPartial
          ? `${playerSummary.sum.toLocaleString(numberLocale)} · ${dictionary.servers.playersUnknown}`
          : playerSummary.sum.toLocaleString(numberLocale);
  const serversLabel = directory?.servers.length ?? "—";
  const spotlight = directory?.servers.slice(0, 6) ?? [];

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
              className={buttonClassName({
                variant: "primary",
                size: "hero",
                className:
                  "transition-[transform,opacity] hover:opacity-90 motion-safe:hover:-translate-y-0.5",
              })}
            >
              {dictionary.home.exploreServers}
            </Link>
            <Link
              href="/market?maxPrice=0"
              className={buttonClassName({
                variant: "outline",
                size: "hero",
                className:
                  "border-base bg-elevated font-semibold transition-[transform,colors] motion-safe:hover:-translate-y-0.5",
              })}
            >
              {dictionary.home.browseResources}
            </Link>
          </div>
        </div>
      </section>

      {session && personalSummary ? (
        <HomePersonalChangesPanel
          summary={personalSummary}
          preference={personalPreference}
          copy={{
            title: dictionary.home.personalTitle,
            description: dictionary.home.personalDescription,
            scopeNote: dictionary.home.personalScopeNote,
            empty: dictionary.home.personalEmpty,
            error: dictionary.home.personalError,
            partial: dictionary.home.personalPartial,
            hidden: dictionary.home.personalHidden,
            hidePreference: dictionary.home.personalHide,
            showPreference: dictionary.home.personalShow,
            reasonReleaseWatch: dictionary.home.personalReasonReleaseWatch,
            reasonDiscussionFollow: dictionary.home.personalReasonDiscussionFollow,
            reasonReplyToMe: dictionary.home.personalReasonReplyToMe,
            openInbox: dictionary.home.personalOpenInbox,
          }}
        />
      ) : null}

      <section aria-labelledby="home-network-heading">
        <SectionHeader
          title={dictionary.home.networkTitle}
          description={dictionary.home.networkDescription}
          titleId="home-network-heading"
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
            {spotlight.map((server) => {
              const matched = nexusListings.find((listing) => matchesMtaEndpoint(listing, server));
              return (
                <HomeNetworkServerCard
                  key={`${server.address}:${server.port}`}
                  observation={server}
                  locale={locale}
                  profileSlug={matched?.slug}
                  isStale={directory.isStale}
                />
              );
            })}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-muted">
            {dictionary.home.directoryPanelUnavailable}
          </div>
        )}
      </section>

      <section aria-labelledby="home-free-resources-heading">
        <SectionHeader
          title={dictionary.home.resourcesTitle}
          description={dictionary.home.resourcesDescription}
          titleId="home-free-resources-heading"
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
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                attribution={resourceAttributions.get(product.id) ?? null}
              />
            ))}
          </div>
        ) : (
          <div className="nexus-panel p-8 text-center text-sm text-muted">
            {dictionary.home.noResources}
          </div>
        )}
      </section>

      <section aria-labelledby="home-community-updates-heading">
        <SectionHeader
          title={dictionary.home.updatesTitle}
          description={dictionary.home.updatesDescription}
          titleId="home-community-updates-heading"
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
