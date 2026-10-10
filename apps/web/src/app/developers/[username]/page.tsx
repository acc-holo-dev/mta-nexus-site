import { FollowButton } from "../../../components/follow-button";
import { ProfileResourcePagination } from "../../../components/profile-resource-pagination";
import { parseProfilePage } from "../../../lib/profile-pagination";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Avatar, EmptyState, StatCard } from "@nexus/ui";
import { authService } from "../../../lib/services/auth-service";
import { productRepository } from "@nexus/db";
import type { Metadata } from "next";
import { ProductCard } from "../../../components/product-card";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { cache } from "react";

export const dynamic = "force-dynamic";

const getProfile = cache((username: string) => authService.getUserByUsername(username));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const [locale, user] = await Promise.all([getRequestLocale(), getProfile(username)]);
  const dictionary = getDictionary(locale);
  if (!user || (user.role !== "developer" && user.role !== "admin")) {
    return { title: dictionary.profiles.userNotFound, robots: { index: false, follow: false } };
  }
  return {
    title: `${user.displayName} (@${user.username})`,
    description: user.bio?.slice(0, 155) || dictionary.developers.bioFallback,
    alternates: { canonical: `/developers/${encodeURIComponent(user.username)}` },
  };
}

export default async function DeveloperProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const { username } = await params;
  const [locale, user] = await Promise.all([getRequestLocale(), getProfile(username)]);
  const dictionary = getDictionary(locale);
  const copy = dictionary.developers;

  if (!user || (user.role !== "developer" && user.role !== "admin")) {
    notFound();
  }

  const query = await searchParams;
  const requestedPage = parseProfilePage(query?.page);
  const result = await productRepository.pagePublishedFreeByAuthor(user.id, requestedPage, 24);
  const authorProducts = result.products;
  const profilePath = `/developers/${encodeURIComponent(user.username)}`;

  return (
    <div className="space-y-10">
      <section className="nexus-panel flex flex-col justify-between gap-6 p-6 shadow-nexus-sm md:flex-row md:items-center md:p-8">
        <div className="flex min-w-0 items-center gap-5 sm:gap-6">
          <Avatar
            src={user.avatarUrl || undefined}
            alt={user.displayName}
            fallback={user.displayName || user.username}
            size="lg"
            className="h-20 w-20 shrink-0 border-2 border-[color:var(--nexus-accent)]/30"
          />
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-black text-primary">{user.displayName}</h1>
              {user.isVerified && (
                <span title={copy.verifiedIdentity}>
                  <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" />
                </span>
              )}
            </div>
            <div className="truncate text-xs text-faint">@{user.username}</div>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              {user.bio || copy.bioFallback}
            </p>
            <FollowButton targetType="user" targetId={user.id} targetName={user.displayName} />
          </div>
        </div>

        <div className="grid min-w-48 grid-cols-2 gap-3">
          <StatCard label={copy.resources} value={result.total} tone="accent" />
          <StatCard
            label={copy.profileStatus}
            value={user.isVerified ? copy.verified : copy.public}
            tone={user.isVerified ? "success" : "default"}
          />
        </div>
      </section>

      <section id="resources" className="space-y-6">
        <h2 className="font-heading text-primary">
          {copy.releasesBy} {user.displayName}
        </h2>
        {authorProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {authorProducts.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} />
            ))}
          </div>
        ) : (
          <EmptyState title={copy.noReleases} description={copy.bioFallback} />
        )}
        <ProfileResourcePagination basePath={profilePath} page={result.page} totalPages={result.totalPages} locale={locale} />
      </section>
    </div>
  );
}
