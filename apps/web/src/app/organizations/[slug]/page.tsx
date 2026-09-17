import { notFound } from "next/navigation";
import Link from "next/link";
import {
  organizationRepository,
  productRepository,
  contentRepository,
} from "@nexus/db";
import { ProductCard } from "../../../components/product-card";
import { ArticleCard } from "../../../components/article-card";
import {
  Building2,
  ShieldCheck,
  Globe,
  ExternalLink,
  Users,
  Box
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrganizationProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await organizationRepository.findBySlug(slug);

  if (!org) {
    notFound();
  }

  const [allProducts, allServers, allArticles] = await Promise.all([
    productRepository.list(),
    contentRepository.listPublished(),
  ]);

  const orgProducts = allProducts.filter((p) => p.organizationId === org.id);
  const orgArticles = allArticles.filter((a) => a.organizationId === org.id);

  return (
    <div className="space-y-10">
      {/* Organization Banner / Header */}
      <div className="p-8 rounded-2xl border border-base bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-neutral-900 border-2 border-amber-500/50 shadow-xl p-2 shrink-0">
            <img
              src={org.logoUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${org.slug}`}
              alt={org.name}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">{org.name}</h1>
              {org.isVerified && (
                <span title="Verified Organization">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                COMMUNITY
              </span>
            </div>
            <div className="text-xs text-neutral-500">@{org.slug}</div>
            <p className="text-xs text-neutral-300 max-w-xl">
              {org.description || "MTA community, creator collective, or resource publisher."}
            </p>
            {org.websiteUrl && (
              <a
                href={org.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:underline pt-1"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{org.websiteUrl}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-base text-center min-w-24">
            <div className="text-lg font-bold text-white">{orgProducts.length}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Releases</div>
          </div>
        </div>
      </div>

      {/* Organization Releases */}
      {orgProducts.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            Studio Marketplace Releases ({orgProducts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {orgProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Organization Articles */}
      {orgArticles.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            Technical Articles & Devlogs ({orgArticles.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {orgArticles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
