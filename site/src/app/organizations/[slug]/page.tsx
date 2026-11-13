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
import { ArticleCard } from "../../../components/article-card";
import { FollowButton } from "../../../components/follow-button";
import { ProductCard } from "../../../components/product-card";
import { ProfileResourcePagination } from "../../../components/profile-resource-pagination";
import { buildFollowInitialState } from "../../../lib/follow-initial-state";
import { getDictionary } from "../../../lib/i18n";
import { getRequestCookieStore, getRequestLocale } from "../../../lib/i18n-server";
import { parseProfilePage } from "../../../lib/profile-pagination";
import { contextTrustCopy } from "../../../lib/public-context-trust-copy";
import { publicationCopy } from "../../../lib/publication-feed-copy";
import { authService } from "../../../lib/services/auth-service";
import { productService } from "../../../lib/services/product-service";

export const dynamic = "force-dynamic";

const pageShellClass = "min-w-0 space-y-10 overflow-x-clip";
const actionLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

const getProfile = cache((slug: string) => organizationRepository.findBySlug(slug));

export async function generateMetadata({
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

export default async function OrganizationProfilePage({
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
    authService.getSession(sessionToken).catch(() => null),
  ]).catch(() => {
    loadError = true;
    return null;
  });

  if (loadError || !loaded) {
    return (
      <div className="min-w-0 space-y-6 overflow-x-clip">
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link href={profileHref} className={actionLinkClass}>
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
    <div className={pageShellClass}>
      <section className="nexus-panel flex min-w-0 flex-col justify-between gap-6 overflow-x-clip p-6 shadow-nexus-sm md:flex-row md:items-center md:p-8">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
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

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-black text-primary">{organization.name}</h1>
              {organization.isVerified && (
                <span title={copy.verified}>
                  <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
                </span>
              )}
              <span className="rounded border border-[color:var(--nexus-warning)]/20 bg-warning-soft px-2 py-0.5 font-label uppercase text-warning">
                {copy.community}
              </span>
            </div>

            <div className="truncate text-xs text-faint">@{organization.slug}</div>

            <p className="max-w-xl text-sm leading-relaxed text-muted">
              {organization.description || copy.fallback}
            </p>

            <FollowButton
              targetType="organization"
              targetId={organization.id}
              targetName={organization.name}
              initial={followInitial}
            />
            <Link href={`${profileHref}/activity`} className={actionLinkClass}>
              {publicationCopy(locale).activity}
            </Link>
            <Link href={`${profileHref}/trust`} className={actionLinkClass}>
              {contextTrustCopy(locale).title}
            </Link>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 max-w-full items-center gap-1.5 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
          description={copy.emptyPortfolioHint}
          action={
            <Link href="/market?maxPrice=0" className={actionLinkClass}>
              {dictionary.home.browseResources}
            </Link>
          }
        />
      ) : null}

      {resourcePage.total > 0 && (
        <section id="resources" className="min-w-0 space-y-4 overflow-x-clip">
          <h2 className="font-heading text-primary">
            {copy.marketplaceReleases} ({resourcePage.total})
          </h2>
          <div className="grid min-w-0 grid-cols-1 gap-6 overflow-x-clip sm:grid-cols-2 lg:grid-cols-4">
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
        <section id="articles" className="min-w-0 space-y-4 overflow-x-clip">
          <h2 className="font-heading text-primary">
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
