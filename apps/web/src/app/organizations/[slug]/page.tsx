import { safeExternalWebUrl } from "@nexus/validation";
import { ProfileResourcePagination } from "../../../components/profile-resource-pagination";
import { parseProfilePage } from "../../../lib/profile-pagination";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Building2,
  ExternalLink,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { StatCard } from "@nexus/ui";
import {
  contentRepository,
  organizationRepository,
  productRepository,
} from "@nexus/db";
import { ProductCard } from "../../../components/product-card";
import { ArticleCard } from "../../../components/article-card";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [locale, organization] = await Promise.all([
    getRequestLocale(),
    organizationRepository.findBySlug(slug),
  ]);
  const dictionary = getDictionary(locale);
  if (!organization) {
    return {
      title: dictionary.errors.notFoundTitle,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: organization.name,
    description: organization.description?.trim().slice(0, 155) || dictionary.organizations.fallback,
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
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.organizations;
  const organization = await organizationRepository.findBySlug(slug);

  if (!organization) {
    notFound();
  }

  const websiteUrl = safeExternalWebUrl(organization.websiteUrl);
  const query = await searchParams;
  const [resourcePage, articlePage] = await Promise.all([
    productRepository.pagePublishedFreeByOrganization(organization.id, parseProfilePage(query?.page), 24),
    contentRepository.pagePublishedEditorialByOrganization(organization.id, parseProfilePage(query?.articlePage), 12),
  ]);
  const products = resourcePage.products;
  const articles = articlePage.items;

  return (
    <div className="space-y-10">
      <section className="nexus-panel flex flex-col justify-between gap-6 p-6 shadow-nexus-sm md:flex-row md:items-center md:p-8">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-base bg-inset text-muted shadow-nexus-sm">
            {organization.logoUrl ? (
              <img
                src={organization.logoUrl}
                alt={organization.name}
                width={80}
                height={80}
                decoding="async"
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <Building2 className="h-8 w-8" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-black text-primary">
                {organization.name}
              </h1>
              {organization.isVerified && (
                <span title={copy.verified}>
                  <ShieldCheck
                    className="h-5 w-5 text-success"
                    aria-hidden="true"
                  />
                </span>
              )}
              <span className="rounded border border-[color:var(--nexus-warning)]/20 bg-warning-soft px-2 py-0.5 font-label uppercase text-warning">
                {copy.community}
              </span>
            </div>

            <div className="truncate text-xs text-faint">
              @{organization.slug}
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-muted">
              {organization.description || copy.fallback}
            </p>

            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 pt-1 text-xs font-semibold text-accent hover:underline"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{websiteUrl}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>

        <div className="min-w-28">
          <StatCard
            label={copy.releases}
            value={resourcePage.total}
            tone="accent"
          />
        </div>
      </section>

      {resourcePage.total > 0 && (
        <section id="resources" className="space-y-4">
          <h2 className="font-heading text-primary">
            {copy.marketplaceReleases} ({resourcePage.total})
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
              />
            ))}
          </div>
          <ProfileResourcePagination basePath={`/organizations/${encodeURIComponent(organization.slug)}`} page={resourcePage.page} totalPages={resourcePage.totalPages} locale={locale} otherSection="articles" otherPage={articlePage.page} />
        </section>
      )}

      {articlePage.total > 0 && (
        <section id="articles" className="space-y-4">
          <h2 className="font-heading text-primary">
            {copy.articles} ({articlePage.total})
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                locale={locale}
              />
            ))}
          </div>
          <ProfileResourcePagination basePath={`/organizations/${encodeURIComponent(organization.slug)}`} page={articlePage.page} totalPages={articlePage.totalPages} locale={locale} section="articles" otherPage={resourcePage.page} />
        </section>
      )}
    </div>
  );
}
