import type { User } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { type2xlBoldPrimary, typeMt2SmMuted } from "../../shell/type-shell";
import { PublicationFeed } from "../publication-feed";
import { publicationCopy } from "../publication-feed-copy";
import { publicationFeedView } from "../publication-feed-view";

export async function followingFeedMetadata(): Promise<Metadata> {
  const copy = publicationCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}
export async function FollowingFeedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = publicationCopy(locale),
    rawSearchParams = (await searchParams) ?? {},
    returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
    else if (value !== undefined) returnParams.append(key, value);
  }
  const returnPath = returnParams.size ? `/workspace/feed?${returnParams}` : "/workspace/feed";
  let actor: User | null;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.error}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const { filters, initial, errorCode } = await publicationFeedView(
    { kind: "following", actorId: actor.id },
    await searchParams,
  );
  return (
    <div className={pageShellClass}>
      <header>
        <h1 id="following-feed-heading" className={type2xlBoldPrimary}>
          {copy.title}
        </h1>
        <p className={typeMt2SmMuted}>{copy.description}</p>
      </header>
      <PublicationFeed
        key={`${actor.id}:${JSON.stringify(filters)}`}
        initial={initial}
        filters={filters}
        locale={locale}
        path="/workspace/feed"
        errorCode={errorCode}
        following
        sectionLabelledBy="following-feed-heading"
      />
    </div>
  );
}
