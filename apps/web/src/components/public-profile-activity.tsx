import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { publicationCopy } from "../lib/publication-feed-copy";
import { publicationFeedView } from "../lib/publication-feed-view";
import { publicationFeedService } from "../lib/services/publication-feed-service";
import { PublicationFeed } from "./publication-feed";

const linkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
  const dictionary = getDictionary(locale);
  const profile = await publicationFeedService.resolve(kind, handle).catch((error: unknown) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  const profilePath = `/${kind === "user" ? "users" : kind === "server" ? "servers" : "organizations"}/${encodeURIComponent(handle)}`;
  const activityPath = `${profilePath}/${kind === "server" ? "updates" : "activity"}`;
  if (!profile) {
    return (
      <div className="min-w-0 space-y-6 overflow-x-clip">
        <Link href={profilePath} className={linkClass}>
          {kind === "server" ? copy.serverBack : copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          action={
            <Link href={activityPath} className={linkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const { filters, initial, errorCode } = await publicationFeedView(
    { kind, id: profile.id },
    await searchParams,
  );
  return (
    <div className="min-w-0 space-y-6 overflow-x-clip">
      <header className="space-y-2">
        <Link href={profilePath} className={linkClass}>
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
        path={activityPath}
        server={kind === "server"}
        errorCode={errorCode}
      />
    </div>
  );
}
