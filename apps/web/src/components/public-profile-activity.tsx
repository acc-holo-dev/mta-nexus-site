import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { PublicationFeed } from "./publication-feed";
import { publicationFeedView } from "../lib/publication-feed-view";
import { publicationCopy } from "../lib/publication-feed-copy";
import { getRequestLocale } from "../lib/i18n-server";
import { publicationFeedService } from "../lib/services/publication-feed-service";
export async function PublicProfileActivity({
  kind,
  handle,
  searchParams,
}: {
  kind: "user" | "organization" | "server";
  handle: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = publicationCopy(locale);
  const profile = await publicationFeedService.resolve(kind, handle).catch((error: unknown) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    throw error;
  });
  const { filters, initial, errorCode } = await publicationFeedView(
    { kind, id: profile.id },
    await searchParams,
  );
  const profilePath = `/${kind === "user" ? "users" : kind === "server" ? "servers" : "organizations"}/${encodeURIComponent(handle)}`;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href={profilePath} className="text-sm text-accent underline">
          {kind === "server" ? copy.serverBack : copy.back}
        </Link>
        <h1 className="text-2xl font-bold text-primary">
          {profile.name}: {kind === "server" ? copy.serverTitle : copy.activity}
        </h1>
        <p className="text-sm text-muted">
          {kind === "server" ? copy.serverDescription : copy.publicDescription}
        </p>
      </header>
      <PublicationFeed
        key={`${kind}:${profile.id}:${JSON.stringify(filters)}`}
        initial={initial}
        filters={filters}
        locale={locale}
        path={`${profilePath}/${kind === "server" ? "updates" : "activity"}`}
        server={kind === "server"}
        errorCode={errorCode}
      />
    </div>
  );
}
