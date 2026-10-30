import { AppError, CONTENT_REACTION_EMOJI, CONTENT_REACTIONS } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { ReactionRemoval } from "../../../components/reaction-removal";
import { parseReactionPage, reactionPageHref } from "../../../lib/content-reaction-contract";
import { reactionCopy, reactionError } from "../../../lib/content-reaction-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { contentReactionService } from "../../../lib/services/content-reaction-service";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const copy = reactionCopy(await getRequestLocale());
  return { title: copy.my, description: copy.description, robots: { index: false, follow: false } };
}
export default async function ReactionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = reactionCopy(locale),
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <div className="nexus-panel mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold text-primary">{copy.my}</h1>
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const part of value) params.append(key, part);
    else if (value !== undefined) params.append(key, value);
  }
  const filters = parseReactionPage(params),
    latest = filters ? reactionPageHref(filters) : "/workspace/reactions";
  let error = filters ? "" : copy.invalid;
  const page = filters
    ? await contentReactionService.page(actor, filters).catch((failure: unknown) => {
        error =
          failure instanceof AppError ? reactionError(locale, failure.code) : copy.unavailable;
        return null;
      })
    : null;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/workspace"
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.back}
      </Link>
      <header className="border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.my}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <form
        action="/workspace/reactions"
        method="get"
        className="nexus-panel flex flex-wrap items-end gap-3 p-4"
      >
        <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
          {copy.query}
          <input
            type="search"
            name="q"
            maxLength={100}
            defaultValue={filters?.query ?? ""}
            className="nexus-input block min-h-11 w-full"
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          {copy.title}
          <select
            name="reaction"
            defaultValue={filters?.reaction ?? ""}
            className="nexus-input block min-h-11"
          >
            <option value="">{copy.all}</option>
            {CONTENT_REACTIONS.map((reaction) => (
              <option key={reaction} value={reaction}>
                {copy[reaction]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-11 font-semibold">
          {copy.search}
        </Button>
        <Link
          href="/workspace/reactions"
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reset}
        </Link>
      </form>
      <a href={latest} className="inline-flex min-h-11 items-center text-sm text-accent underline">
        {copy.latest}
      </a>
      {error && (
        <p role="alert" className="nexus-panel p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {page && !page.items.length && (
        <p className="nexus-panel p-6 text-sm text-muted">
          {filters?.cursor || filters?.query || filters?.reaction ? copy.emptyFiltered : copy.empty}
        </p>
      )}
      {page && (
        <ul className="space-y-3">
          {page.items.map((item) => (
            <li key={item.contentId} className="nexus-panel space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {item.slug && item.title ? (
                    <Link
                      prefetch={false}
                      href={`/articles/${encodeURIComponent(item.slug)}`}
                      className="break-words font-semibold text-primary hover:text-accent"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <>
                      <p className="font-semibold text-muted">{copy.hidden}</p>
                      <p className="text-xs text-muted">{copy.hiddenDescription}</p>
                    </>
                  )}
                  <p className="mt-2 text-sm text-secondary">
                    <span aria-hidden="true">{CONTENT_REACTION_EMOJI[item.reaction]}</span>{" "}
                    {copy[item.reaction]}
                  </p>
                  <time className="text-xs text-muted" dateTime={item.reactedAt}>
                    {new Date(item.reactedAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </time>
                </div>
                <ReactionRemoval contentId={item.contentId} locale={locale} reloadHref={latest} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {page?.nextCursor && filters && (
        <Link
          prefetch={false}
          href={reactionPageHref(filters, page.nextCursor)}
          className="inline-flex min-h-11 items-center rounded-lg border border-base px-4 text-sm text-secondary"
        >
          {copy.next}
        </Link>
      )}
    </div>
  );
}
