import { followWorkspaceRepository, productRepository } from "@nexus/db";
import { Avatar, EmptyState, ErrorState, StatCard } from "@nexus/ui";
import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDictionary } from "../../../lib/i18n";
import { getRequestCookieStore, getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { profilePrivacyService } from "../../../lib/services/accounts/profile-privacy-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { verificationWorkspaceService } from "../../../lib/services/moderation/verification-workspace-service";
import { FollowButton } from "../../community/follow";
import { buildFollowInitialState } from "../../community/follow-initial-state";
import { publicationCopy } from "../../community/publication-feed-copy";
import { ProductCard } from "../../resources/view";
import { pageShellStack10 as pageShellClass, pageShellStack6 } from "../../shell/page-shell";
import { panelHeroBetween } from "../../shell/panel-shell";
import {
  typeFlexCenterGap2,
  typeFlexMinCenterGap5Sm6,
  typeHeadingPrimary,
  typeIcon5Success,
  typeMaxXlSmLeadingMuted,
  typeMinSpace15,
  typeTruncate2xlBlackPrimary,
  typeTruncateXsFaint,
} from "../../shell/type-shell";
import { trustCopy } from "../../trust/public-user-trust-copy";
import { DeveloperExperience } from "../developer-experience";
import { ProfileResourcePagination, parseProfilePage } from "../profile-pagination";

const actionLinkClass =
  "inline-flex min-h-11 items-center rounded-md px-0.5 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

const getProfile = cache((username: string) => authService.getUserByUsername(username));

export async function developerProfileMetadata({
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

export async function DeveloperProfileScreen({
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
  const profilePath = `/developers/${encodeURIComponent(user.username)}`;
  const sessionToken = (await getRequestCookieStore()).get("nexus_session")?.value;
  let loadError = false;
  const loaded = await Promise.all([
    productRepository.pagePublishedFreeByAuthor(user.id, requestedPage, 24),
    verificationWorkspaceService.publicProfile(user.id).catch(() => null),
    profilePrivacyService.visibility(user.id),
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
            <Link href={profilePath} className={actionLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const [result, professional, visibility, actor] = loaded;
  const [savedFollowIds, userMute] = await Promise.all([
    actor
      ? followWorkspaceRepository.states(actor.id, "user", [user.id]).catch(() => null)
      : Promise.resolve([] as string[]),
    actor
      ? followWorkspaceRepository.muteState(actor.id, "user", user.id).catch(() => null)
      : Promise.resolve(null),
  ]);
  const followInitial = buildFollowInitialState({
    actor,
    targetId: user.id,
    followedIds: savedFollowIds,
    mute: userMute,
    self: actor?.id === user.id,
  });
  const authorProducts = result.products;
  const attributions = await productService
    .getPublicAttributions(authorProducts)
    .catch(() => new Map());

  return (
    <div className={pageShellClass}>
      <section className={panelHeroBetween}>
        <div className={typeFlexMinCenterGap5Sm6}>
          <Avatar
            src={user.avatarUrl || undefined}
            alt={user.displayName}
            fallback={user.displayName || user.username}
            size="lg"
            className="h-20 w-20 shrink-0 border-2 border-[color:var(--nexus-accent)]/30"
          />
          <div className={typeMinSpace15}>
            <div className={typeFlexCenterGap2}>
              <h1 className={typeTruncate2xlBlackPrimary}>{user.displayName}</h1>
              {user.isVerified && (
                <span title={copy.verifiedIdentity}>
                  <ShieldCheck className={typeIcon5Success} aria-hidden="true" />
                </span>
              )}
            </div>
            <div className={typeTruncateXsFaint}>@{user.username}</div>
            <p className={typeMaxXlSmLeadingMuted}>{user.bio || copy.bioFallback}</p>
            <FollowButton
              targetType="user"
              targetId={user.id}
              targetName={user.displayName}
              initial={followInitial}
            />
            <nav
              aria-label={copy.creatorProfile}
              className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2"
            >
              <Link
                href={`/users/${encodeURIComponent(user.username)}/trust`}
                className={actionLinkClass}
              >
                {trustCopy(locale).title}
              </Link>
              {visibility.showActivity && (
                <Link
                  href={`/users/${encodeURIComponent(user.username)}/activity`}
                  className={actionLinkClass}
                >
                  {publicationCopy(locale).activity}
                </Link>
              )}
            </nav>
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

      <DeveloperExperience profile={professional} locale={locale} />
      <section id="resources" className={pageShellStack6}>
        <h2 className={typeHeadingPrimary}>
          {copy.releasesBy} {user.displayName}
        </h2>
        {authorProducts.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 gap-6 overflow-x-clip sm:grid-cols-2 lg:grid-cols-4">
            {authorProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                attribution={attributions.get(product.id) ?? null}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={copy.noReleases}
            description={copy.noReleasesHint}
            action={
              <Link href="/market?maxPrice=0" className={actionLinkClass}>
                {dictionary.home.browseResources}
              </Link>
            }
          />
        )}
        <ProfileResourcePagination
          basePath={profilePath}
          page={result.page}
          totalPages={result.totalPages}
          locale={locale}
        />
      </section>
    </div>
  );
}
