import type { User } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { PublicationFeed } from "../../../components/publication-feed";
import { getRequestLocale } from "../../../lib/i18n-server";
import { publicationCopy } from "../../../lib/publication-feed-copy";
import { publicationFeedView } from "../../../lib/publication-feed-view";
import { authService } from "../../../lib/services/auth-service";
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
}) {
  const locale = await getRequestLocale(),
    copy = publicationCopy(locale);
  let actor: User | null;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <div className="nexus-panel space-y-4 p-8">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p role="alert" className="text-sm text-danger">
          {copy.error}
        </p>
        <Link
          href="/workspace/feed"
          className="inline-flex min-h-11 items-center text-accent underline"
        >
          {copy.retry}
        </Link>
      </div>
    );
  }
  if (!actor)
    return (
      <div className="nexus-panel space-y-4 p-8">
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <Link href="/auth/login" className="text-accent underline">
          {copy.signIn}
        </Link>
      </div>
    );
  const { filters, initial, errorCode } = await publicationFeedView(
    { kind: "following", actorId: actor.id },
    await searchParams,
  );
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
        errorCode={errorCode}
        following
      />
    </div>
  );
}
