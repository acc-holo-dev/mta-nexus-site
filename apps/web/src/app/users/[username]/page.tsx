import { DeveloperExperience } from "../../../components/developer-experience";
import { verificationWorkspaceService } from "../../../lib/services/verification-workspace-service";
import { profilePrivacyService } from "../../../lib/services/profile-privacy-service";
import { FollowButton } from "../../../components/follow-button";
import Link from "next/link";
import { publicationCopy } from "../../../lib/publication-feed-copy";
import { ProfileResourcePagination } from "../../../components/profile-resource-pagination";
import { parseProfilePage } from "../../../lib/profile-pagination";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Calendar, ShieldCheck } from "lucide-react";
import { Avatar, StatCard } from "@nexus/ui";
import {
  productRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";
import { ProductCard } from "../../../components/product-card";
import { ServerCard } from "../../../components/server-card";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { indexMtaObservations, mtaMasterDirectoryService } from "../../../lib/services/mta-master-directory-service";
import { cache } from "react";

export const dynamic = "force-dynamic";

const getProfile = cache((username: string) => userRepository.findByUsername(username));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const [locale, user] = await Promise.all([getRequestLocale(), getProfile(username)]);
  const copy = getDictionary(locale).profiles;

  if (!user) {
    return { title: copy.userNotFound, robots: { index: false, follow: false } };
  }

  return {
    title: `${user.displayName} (@${user.username})`,
    description:
      user.bio?.slice(0, 155) ||
      `${copy.profileDescription} ${user.displayName}`,
    alternates: { canonical: `/users/${encodeURIComponent(user.username)}` },
  };
}

export default async function UserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{ page?: string | string[]; serverPage?: string | string[] }>;
}) {
  const { username } = await params;
  const [locale, user] = await Promise.all([getRequestLocale(), getProfile(username)]);
  const dictionary = getDictionary(locale);
  const copy = dictionary.profiles;

  if (!user) {
    notFound();
  }

  const query = await searchParams;
  const [resourcePage, serverPage, professional, visibility] = await Promise.all([
    productRepository.pagePublishedFreeByAuthor(user.id, parseProfilePage(query?.page), 24),
    serverRepository.pageActivePublicByOwner(user.id, parseProfilePage(query?.serverPage), 12),
    user.role === "developer" || user.role === "admin"
      ? verificationWorkspaceService.publicProfile(user.id).catch(() => null)
      : null,
    profilePrivacyService.visibility(user.id),
  ]);
  const userProducts = resourcePage.products;
  const userServers = serverPage.servers;
  const directory = userServers.length > 0
    ? await mtaMasterDirectoryService.getDirectory().catch(() => null)
    : null;
  const observationFor = indexMtaObservations(directory?.servers ?? []);
  const formattedDate = new Date(user.createdAt).toLocaleDateString(
    locale === "ru" ? "ru-RU" : "en-US",
    {
      month: "long",
      year: "numeric",
    },
  );

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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-black text-primary">
                {user.displayName}
              </h1>
              {user.isVerified && (
                <span title={copy.verifiedMember}>
                  <ShieldCheck
                    className="h-5 w-5 text-success"
                    aria-hidden="true"
                  />
                </span>
              )}
              <span className="rounded border border-base bg-inset px-2 py-0.5 font-numeric text-[10px] font-bold uppercase tracking-wider text-secondary">
                {user.role}
              </span>
            </div>
            <div className="truncate text-xs text-faint">
              @{user.username}
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              {user.bio || copy.memberFallback}
            </p>
            <FollowButton targetType="user" targetId={user.id} targetName={user.displayName} />
            {visibility.showActivity && <Link href={`/users/${encodeURIComponent(user.username)}/activity`} className="inline-flex min-h-11 items-center text-sm text-accent underline">{publicationCopy(locale).activity}</Link>}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-faint">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {copy.joined} {formattedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-52 grid-cols-2 gap-3">
          <StatCard
            label={copy.resources}
            value={resourcePage.total}
            tone="accent"
          />
          <StatCard
            label={copy.servers}
            value={serverPage.total}
            tone="success"
          />
        </div>
      </section>

      <DeveloperExperience profile={professional} locale={locale} />
      {resourcePage.total > 0 && (
        <section id="resources" className="space-y-4">
          <h2 className="font-heading text-primary">
            {copy.authoredResources} ({resourcePage.total})
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {userProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
              />
            ))}
          </div>
          <ProfileResourcePagination basePath={`/users/${encodeURIComponent(user.username)}`} page={resourcePage.page} totalPages={resourcePage.totalPages} locale={locale} otherPage={serverPage.page} />
        </section>
      )}

      {serverPage.total > 0 && (
        <section id="servers" className="space-y-4">
          <h2 className="font-heading text-primary">
            {copy.operatedServers} ({serverPage.total})
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {userServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                locale={locale}
                observation={observationFor(server)}
                isStale={directory?.isStale}
              />
            ))}
          </div>
          <ProfileResourcePagination basePath={`/users/${encodeURIComponent(user.username)}`} page={serverPage.page} totalPages={serverPage.totalPages} locale={locale} section="servers" otherPage={resourcePage.page} />
        </section>
      )}
    </div>
  );
}
