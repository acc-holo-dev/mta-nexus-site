import {
  followWorkspaceRepository,
  productRepository,
  serverRepository,
  userRepository,
} from "@nexus/db";
import { Avatar, ErrorState, StatCard } from "@nexus/ui";
import { Calendar, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDictionary } from "../../../lib/i18n";
import { getRequestCookieStore, getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { profilePrivacyService } from "../../../lib/services/accounts/profile-privacy-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { verificationWorkspaceService } from "../../../lib/services/moderation/verification-workspace-service";
import {
  indexMtaObservations,
  mtaMasterDirectoryService,
} from "../../../lib/services/servers/mta-master-directory-service";
import { FollowButton } from "../../community/follow";
import { buildFollowInitialState } from "../../community/follow-initial-state";
import { publicationCopy } from "../../community/publication-feed-copy";
import { ObjectReportForm } from "../../moderation/object-report";
import { ProductCard } from "../../resources/view";
import { ServerCard } from "../../servers/client";
import { authEntryHref } from "../../shell/auth-return";
import { linkAccentSm, linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellStack6, pageShellStack10 } from "../../shell/page-shell";
import { surfaceInsetP4TextSmMuted } from "../../shell/surface-shell";
import {
  typeAvatarAccentBorder,
  typeFlexMinCenterGap5Sm6,
  typeFlexWrapCenterGap2,
  typeGridCols1Gap6Md3,
  typeHeadingPrimary,
  typeIcon5Success,
  typeIcon35,
  typeMaxXlSmLeadingMuted,
  typeMinSpace15,
  typeTruncate2xlBlackPrimary,
  typeTruncateXsFaint,
} from "../../shell/type-shell";
import { trustCopy } from "../../trust/public-user-trust-copy";
import { DeveloperExperience } from "../developer-experience";
import { ProfileResourcePagination, parseProfilePage } from "../profile-pagination";
import { profilePrivacyCopy } from "../profile-privacy-copy";

const getProfile = cache((username: string) => userRepository.findByUsername(username));

export async function userProfileMetadata({
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
    description: user.bio?.slice(0, 155) || `${copy.profileDescription} ${user.displayName}`,
    alternates: { canonical: `/users/${encodeURIComponent(user.username)}` },
  };
}

export async function UserProfileScreen({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{
    page?: string | string[];
    serverPage?: string | string[];
    preview?: string | string[];
  }>;
}) {
  const { username } = await params;
  const [locale, user] = await Promise.all([getRequestLocale(), getProfile(username)]);
  const dictionary = getDictionary(locale);
  const copy = dictionary.profiles;
  const privacyCopy = profilePrivacyCopy(locale);
  const walletEnabled = isWalletEngineEnabled();

  if (!user) {
    notFound();
  }

  const query = await searchParams;
  const previewRaw = query?.preview;
  const wantsGuestPreview = (Array.isArray(previewRaw) ? previewRaw[0] : previewRaw) === "guest";
  const sessionToken = (await getRequestCookieStore()).get("nexus_session")?.value;
  const resourcePageNumber = parseProfilePage(query?.page);
  const serverPageNumber = parseProfilePage(query?.serverPage);
  const profileHref = `/users/${encodeURIComponent(user.username)}`;
  let loadError = false;
  const loaded = await Promise.all([
    productRepository.pagePublishedFreeByAuthor(user.id, resourcePageNumber, 24, {
      includeWalletPaidSingleServer: walletEnabled,
    }),
    serverRepository.pageActivePublicByOwner(user.id, serverPageNumber, 12),
    user.role === "developer" || user.role === "admin"
      ? verificationWorkspaceService.publicProfile(user.id).catch(() => null)
      : Promise.resolve(null),
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
            <Link href={profileHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }

  const [resourcePage, serverPage, professional, visibility, actor] = loaded;
  const guestPreview = wantsGuestPreview && actor?.id === user.id;
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
  const userProducts = resourcePage.products;
  const attributions = await productService
    .getPublicAttributions(userProducts)
    .catch(() => new Map());
  const userServers = serverPage.servers;
  const directory =
    userServers.length > 0
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
    <div className={pageShellStack10}>
      {guestPreview && (
        <p role="status" className={surfaceInsetP4TextSmMuted}>
          {privacyCopy.guestPreviewNote} {privacyCopy.scope}
        </p>
      )}
      <section className="nexus-panel flex flex-col justify-between gap-6 p-6 shadow-nexus-sm md:flex-row md:items-center md:p-8">
        <div className={typeFlexMinCenterGap5Sm6}>
          <Avatar
            src={user.avatarUrl || undefined}
            alt={user.displayName}
            fallback={user.displayName || user.username}
            size="lg"
            className={typeAvatarAccentBorder}
          />
          <div className={typeMinSpace15}>
            <div className={typeFlexWrapCenterGap2}>
              <h1 className={typeTruncate2xlBlackPrimary}>{user.displayName}</h1>
              {user.isVerified && (
                <span title={copy.verifiedMember}>
                  <ShieldCheck className={typeIcon5Success} aria-hidden="true" />
                </span>
              )}
              <span className="rounded border border-base bg-inset px-2 py-0.5 font-numeric text-[10px] font-bold uppercase tracking-wider text-secondary">
                {user.role}
              </span>
            </div>
            <div className={typeTruncateXsFaint}>@{user.username}</div>
            <p className={typeMaxXlSmLeadingMuted}>{user.bio || copy.memberFallback}</p>
            {!guestPreview && (
              <div className="space-y-1">
                <FollowButton
                  targetType="user"
                  targetId={user.id}
                  targetName={user.displayName}
                  initial={followInitial}
                />
                {actor?.id !== user.id ? (
                  <ObjectReportForm
                    targetType="user"
                    targetId={user.id}
                    locale={locale}
                    authenticated={actor === undefined ? null : Boolean(actor)}
                    retryHref={profileHref}
                    loginHref={authEntryHref("login", profileHref)}
                    registerHref={authEntryHref("register", profileHref)}
                  />
                ) : null}
              </div>
            )}
            {visibility.showActivity && (
              <Link
                href={`/users/${encodeURIComponent(user.username)}/activity`}
                className={linkAccentSm}
              >
                {publicationCopy(locale).activity}
              </Link>
            )}
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-faint">
              <Calendar className={typeIcon35} aria-hidden="true" />
              <span>
                {copy.joined} {formattedDate}
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-w-52 grid-cols-2 gap-3">
          <StatCard label={copy.resources} value={resourcePage.total} tone="accent" />
          <StatCard label={copy.servers} value={serverPage.total} tone="success" />
        </div>
      </section>

      <DeveloperExperience profile={professional} locale={locale} />
      <Link href={`/users/${encodeURIComponent(user.username)}/trust`} className={linkAccentSm}>
        {trustCopy(locale).title}
      </Link>
      {resourcePage.total > 0 && (
        <section id="resources" className="space-y-4">
          <h2 className={typeHeadingPrimary}>
            {copy.authoredResources} ({resourcePage.total})
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {userProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                locale={locale}
                attribution={attributions.get(product.id) ?? null}
              />
            ))}
          </div>
          <ProfileResourcePagination
            basePath={`/users/${encodeURIComponent(user.username)}`}
            page={resourcePage.page}
            totalPages={resourcePage.totalPages}
            locale={locale}
            otherPage={serverPage.page}
          />
        </section>
      )}

      {serverPage.total > 0 && (
        <section id="servers" className="space-y-4">
          <h2 className={typeHeadingPrimary}>
            {copy.operatedServers} ({serverPage.total})
          </h2>
          <div className={typeGridCols1Gap6Md3}>
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
          <ProfileResourcePagination
            basePath={`/users/${encodeURIComponent(user.username)}`}
            page={serverPage.page}
            totalPages={serverPage.totalPages}
            locale={locale}
            section="servers"
            otherPage={resourcePage.page}
          />
        </section>
      )}
    </div>
  );
}
