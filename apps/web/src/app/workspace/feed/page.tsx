import type { User } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { PublicationFeed } from "../../../components/publication-feed";
import { getRequestLocale } from "../../../lib/i18n-server";
import { publicationCopy } from "../../../lib/publication-feed-copy";
import { publicationFeedView } from "../../../lib/publication-feed-view";
import { authService } from "../../../lib/services/auth-service";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const retryLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata(): Promise<Metadata> {
  const copy = publicationCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}
export default async function FollowingFeedPage({
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
      <div className={pageShellClass}>
        <header>
          <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted">{copy.description}</p>
        </header>
        <ErrorState
          title={copy.error}
          action={
            <Link href={returnPath} className={retryLinkClass}>
              {copy.retry}
            </Link>
          }
        />
      </div>
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
        <h1 id="following-feed-heading" className="text-2xl font-bold text-primary">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
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
