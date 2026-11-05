import { AppError, CONTENT_REACTION_EMOJI, CONTENT_REACTIONS } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { ReactionRemoval } from "../../../components/reaction-removal";
import { parseReactionPage, reactionPageHref } from "../../../lib/content-reaction-contract";
import { reactionCopy, reactionError } from "../../../lib/content-reaction-copy";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { contentReactionService } from "../../../lib/services/content-reaction-service";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
    dictionary = getDictionary(locale);
  const rawSearchParams = (await searchParams) ?? {};
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
    else if (value !== undefined) returnParams.append(key, value);
  }
  const returnPath = returnParams.size
    ? `/workspace/reactions?${returnParams}`
    : "/workspace/reactions";
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => null);
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
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
  const filtered = Boolean(filters?.cursor || filters?.query || filters?.reaction);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace" className={linkClass}>
        {copy.back}
      </Link>
      <header className="min-w-0 border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.my}</h1>
        <p className="mt-2 text-sm text-muted">{copy.description}</p>
      </header>
      <search aria-label={copy.query}>
        <form
          action="/workspace/reactions"
          method="get"
          className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 p-4"
        >
          <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
            {copy.query}
            <input
              type="search"
              name="q"
              maxLength={100}
              defaultValue={filters?.query ?? ""}
              className={`${fieldClass} block min-h-11 w-full`}
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            {copy.title}
            <select
              name="reaction"
              defaultValue={filters?.reaction ?? ""}
              className={`${fieldClass} block min-h-11`}
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
          <Link href="/workspace/reactions" className={linkClass}>
            {copy.reset}
          </Link>
        </form>
      </search>
      <a href={latest} className={linkClass}>
        {copy.latest}
      </a>
      {error ? (
        <ErrorState
          title={error}
          action={
            <a href={latest} className={linkClass}>
              {dictionary.errors.retry}
            </a>
          }
        />
      ) : null}
      {page && !page.items.length ? (
        <EmptyState
          title={filtered ? copy.emptyFiltered : copy.empty}
          description={filtered ? copy.emptyFilteredDescription : copy.emptyDescription}
          action={
            filtered ? (
              <Link href="/workspace/reactions" className={linkClass}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {page?.items.length ? (
        <ul className="min-w-0 space-y-3">
          {page.items.map((item) => (
            <li key={item.contentId} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 overflow-x-clip">
                  {item.slug && item.title ? (
                    <Link
                      prefetch={false}
                      href={`/articles/${encodeURIComponent(item.slug)}`}
                      className="break-words font-semibold text-primary hover:text-accent"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <ErrorState
                      id="workspace-reactions-publication-unavailable"
                      title={copy.hidden}
                      description={copy.hiddenDescription}
                      className="items-start py-4 text-left"
                    />
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
                <ReactionRemoval
                  key={`${actor.id}:${item.contentId}`}
                  actorId={actor.id}
                  contentId={item.contentId}
                  locale={locale}
                  reloadHref={latest}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {page?.nextCursor && filters ? (
        <Link
          prefetch={false}
          href={reactionPageHref(filters, page.nextCursor)}
          className="inline-flex min-h-11 items-center rounded-lg border border-base px-4 text-sm text-secondary"
        >
          {copy.next}
        </Link>
      ) : null}
    </div>
  );
}
