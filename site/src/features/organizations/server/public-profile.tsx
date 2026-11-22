import {
  contentRepository,
  followWorkspaceRepository,
  organizationRepository,
  productRepository,
} from "@nexus/db";
import { EmptyState, ErrorState, StatCard } from "@nexus/ui";
import { safeExternalWebUrl } from "@nexus/validation";
import { Building2, ExternalLink, Globe, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDictionary } from "../../../lib/i18n";
import { getRequestCookieStore, getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { ProfileResourcePagination, parseProfilePage } from "../../accounts/profile-pagination";
import { ArticleCard } from "../../community/article-view";
import { FollowButton } from "../../community/follow";
import { buildFollowInitialState } from "../../community/follow-initial-state";
import { publicationCopy } from "../../community/publication-feed-copy";
import { libraryMarketHref } from "../../library/library-view";
import { ProductCard } from "../../resources/view";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellStack4, pageShellStack6, pageShellStack10 } from "../../shell/page-shell";
import { panelHeroBetween } from "../../shell/panel-shell";
import {
  typeFlexMinCenterGap5Sm6,
  typeFlexWrapCenterGap2,
  typeGridMinCols1Gap6Clip,
  typeH35W35Shrink,
  typeHeadingPrimary,
  typeIcon5Success,
  typeMaxXlSmLeadingMuted,
  typeMinSpace15,
  typeTruncate2xlBlackPrimary,
  typeTruncateXsFaint,
} from "../../shell/type-shell";
import { contextTrustCopy } from "../../trust/public-context-trust-copy";

const getProfile = cache((slug: string) => organizationRepository.findBySlug(slug));

export async function organizationProfileMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [locale, organization] = await Promise.all([getRequestLocale(), getProfile(slug)]);
  const dictionary = getDictionary(locale);
  if (!organization) {
    return {
      title: dictionary.errors.notFoundTitle,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: organization.name,
    description:
      organization.description?.trim().slice(0, 155) || dictionary.organizations.fallback,
    alternates: { canonical: `/organizations/${encodeURIComponent(organization.slug)}` },
  };
}

export async function OrganizationProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string | string[]; articlePage?: string | string[] }>;
}) {
  const { slug } = await params;
  const [locale, organization] = await Promise.all([getRequestLocale(), getProfile(slug)]);
  const dictionary = getDictionary(locale);
  const copy = dictionary.organizations;
  const walletEnabled = isWalletEngineEnabled();
  const marketHref = libraryMarketHref(walletEnabled);

  if (!organization) {
    notFound();
  }

  const logoUrl = safeExternalWebUrl(organization.logoUrl);
  const websiteUrl = safeExternalWebUrl(organization.websiteUrl);
  const query = await searchParams;
  const profileHref = `/organizations/${encodeURIComponent(organization.slug)}`;
  const sessionToken = (await getRequestCookieStore()).get("nexus_session")?.value;
  let loadError = false;
  const loaded = await Promise.all([
    productRepository.pagePublishedFreeByOrganization(
      organization.id,
      parseProfilePage(query?.page),
      24,
    ),
    contentRepository.pagePublishedEditorialByOrganization(
      organization.id,
      parseProfilePage(query?.articlePage),
      12,
    ),
    authService.getSession(sessionToken).catch(() => undefined),
  ]).catch(() => {
    loadError = true;
    return null;
  });

  if (loadError || !loaded) {
    return (
      <div className={pageShellStack6}>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={profileHref} className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const [resourcePage, articlePage, actor] = loaded;
  const [savedFollowIds, orgMute] = await Promise.all([
    actor
      ? followWorkspaceRepository
          .states(actor.id, "organization", [organization.id])
          .catch(() => null)
      : Promise.resolve([] as string[]),
    actor
      ? followWorkspaceRepository
          .muteState(actor.id, "organization", organization.id)
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const followInitial = buildFollowInitialState({
    actor,
    targetId: organization.id,
    followedIds: savedFollowIds,
    mute: orgMute,
  });
  const products = resourcePage.products;
  const attributions = await productService.getPublicAttributions(products).catch(() => new Map());
  const articles = articlePage.items;
  const portfolioEmpty = resourcePage.total === 0 && articlePage.total === 0;

  return (
    <div className={pageShellStack10}>
      <section className={panelHeroBetween}>
        <div className={typeFlexMinCenterGap5Sm6}>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-base bg-inset text-muted shadow-nexus-sm">
            {logoUrl ? (
              <>
                {/* biome-ignore lint/performance/noImgElement: organization-controlled remote logo stays outside the trusted image-optimizer allowlist. */}
                <img
                  src={logoUrl}
                  alt={organization.name}
                  width={80}
                  height={80}
                  decoding="async"
                  className="h-full w-full object-contain p-2"
                />
              </>
            ) : (
              <Building2 className="h-8 w-8" aria-hidden="true" />
            )}
          </div>

          <div className={typeMinSpace15}>
            <div className={typeFlexWrapCenterGap2}>
              <h1 className={typeTruncate2xlBlackPrimary}>{organization.name}</h1>
              {organization.isVerified && (
                <span title={copy.verified}>
                  <ShieldCheck className={typeIcon5Success} aria-hidden="true" />
                </span>
              )}
              <span className="rounded border border-[color:var(--nexus-warning)]/20 bg-warning-soft px-2 py-0.5 font-label uppercase text-warning">
                {copy.community}
              </span>
            </div>

            <div className={typeTruncateXsFaint}>@{organization.slug}</div>

            <p className={typeMaxXlSmLeadingMuted}>{organization.description || copy.fallback}</p>

            <FollowButton
              targetType="organization"
              targetId={organization.id}
              targetName={organization.name}
              initial={followInitial}
            />
            <Link href={`${profileHref}/activity`} className={linkAccentSm}>
              {publicationCopy(locale).activity}
            </Link>
            <Link href={`${profileHref}/trust`} className={linkAccentSm}>
              {contextTrustCopy(locale).title}
            </Link>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 max-w-full items-center gap-1.5 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                <Globe className={typeH35W35Shrink} aria-hidden="true" />
                <span className="truncate">{websiteUrl}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        <div className="min-w-28">
          <StatCard label={copy.releases} value={resourcePage.total} tone="accent" />
        </div>
      </section>

      {portfolioEmpty ? (
        <EmptyState
          title={copy.emptyPortfolio}
          description={walletEnabled ? copy.emptyPortfolioHintWallet : copy.emptyPortfolioHint}
          action={
            <Link href={marketHref} className={linkAccentSm}>
              {walletEnabled
                ? dictionary.home.browseMarketResources
                : dictionary.home.browseResources}
            </Link>
          }
        />
      ) : null}

      {resourcePage.total > 0 && (
        <section id="resources" className={pageShellStack4}>
          <h2 className={typeHeadingPrimary}>
            {copy.marketplaceReleases} ({resourcePage.total})
          </h2>
          <div className={typeGridMinCols1Gap6Clip}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                attribution={attributions.get(product.id) ?? null}
              />
            ))}
          </div>
          <ProfileResourcePagination
            basePath={profileHref}
            page={resourcePage.page}
            totalPages={resourcePage.totalPages}
            locale={locale}
            otherSection="articles"
            otherPage={articlePage.page}
          />
        </section>
      )}

      {articlePage.total > 0 && (
        <section id="articles" className={pageShellStack4}>
          <h2 className={typeHeadingPrimary}>
            {copy.articles} ({articlePage.total})
          </h2>
          <div className="grid min-w-0 grid-cols-1 gap-6 overflow-x-clip md:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} locale={locale} />
            ))}
          </div>
          <ProfileResourcePagination
            basePath={profileHref}
            page={articlePage.page}
            totalPages={articlePage.totalPages}
            locale={locale}
            section="articles"
            otherPage={resourcePage.page}
          />
        </section>
      )}
    </div>
  );
}
