import { cookies } from "next/headers";
import Link from "next/link";
import { PublicationFeed } from "../../../components/publication-feed";
import { publicationPageQuery } from "../../../lib/publication-feed-contract";
import { publicationCopy } from "../../../lib/publication-feed-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { publicationFeedService } from "../../../lib/services/publication-feed-service";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
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
} = {}) {
  const locale = await getRequestLocale(),
    copy = publicationCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <div className="nexus-panel space-y-4 p-8">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </div>
    );
  const filters = publicationPageQuery(await searchParams);
  const initial = await publicationFeedService
    .page({ kind: "following", actorId: actor.id }, filters)
    .catch(() => null);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <PublicationFeed
        key={`${actor.id}:${JSON.stringify(filters)}`}
        initial={initial}
        filters={filters}
        locale={locale}
        path="/workspace/feed"
        apiPath="/api/workspace/feed"
        following
      />
    </div>
  );
}
