import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import {
  ownDiscussionHref,
  parseOwnDiscussionQuery,
} from "../../../lib/discussion-workspace-contract";
import { ownDiscussionCopy, ownDiscussionError } from "../../../lib/discussion-workspace-copy";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { discussionWorkspaceService } from "../../../lib/services/discussion-workspace-service";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const linkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata() {
  const copy = ownDiscussionCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export default async function OwnDiscussionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = ownDiscussionCopy(locale),
    dictionary = getDictionary(locale);
  const rawSearchParams = (await searchParams) ?? {};
  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) for (const part of value) returnParams.append(key, part);
    else if (value !== undefined) returnParams.append(key, value);
  }
  const returnPath = returnParams.size
    ? `/workspace/discussions?${returnParams}`
    : "/workspace/discussions";
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => null);
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) for (const part of value) params.append(key, part);
    else if (value !== undefined) params.append(key, value);
  }
  const filters = parseOwnDiscussionQuery(params),
    latest = filters ? ownDiscussionHref(filters) : "/workspace/discussions";
  let error = filters ? "" : copy.invalid;
  const page = filters
    ? await discussionWorkspaceService.page(actor, filters).catch((failure: unknown) => {
        error =
          failure instanceof AppError ? ownDiscussionError(locale, failure.code) : copy.failed;
        return null;
      })
    : null;
  const filtered = Boolean(filters?.cursor || filters?.query || filters?.availability);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace" className={linkClass}>
        {copy.workspace}
      </Link>
      <header className="min-w-0 space-y-2 border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-xs text-muted">{copy.privacy}</p>
      </header>
      <form
        action="/workspace/discussions"
        method="get"
        className="nexus-panel flex min-w-0 flex-wrap items-end gap-3 p-4"
      >
        <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
          {copy.query}
          <input
            type="search"
            name="q"
            maxLength={120}
            defaultValue={filters?.query ?? ""}
            className={`${fieldClass} block min-h-11 w-full`}
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          {copy.availability}
          <select
            name="availability"
            defaultValue={filters?.availability ?? ""}
            className={`${fieldClass} block min-h-11`}
          >
            <option value="">{copy.all}</option>
            <option value="available">{copy.available}</option>
            <option value="unavailable">{copy.unavailable}</option>
          </select>
        </label>
        <Button type="submit" className="min-h-11 font-semibold">
          {copy.search}
        </Button>
        <Link href="/workspace/discussions" className={linkClass}>
          {copy.reset}
        </Link>
      </form>
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
              <Link href="/workspace/discussions" className={linkClass}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {page?.items.length ? (
        <ul className="min-w-0 space-y-3">
          {page.items.map((item) => (
            <li key={item.id} className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-5">
              <h2 className="min-w-0 break-words font-semibold text-primary">
                {item.title ?? copy.hidden}
              </h2>
              <p className="whitespace-pre-wrap break-words text-sm text-secondary">{item.text}</p>
              <time className="text-xs text-muted" dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
              <div className="flex min-w-0 flex-wrap gap-3">
                <Link
                  prefetch={false}
                  href={`/workspace/discussions/${encodeURIComponent(item.id)}`}
                  className={linkClass}
                >
                  {copy.open}
                </Link>
                {item.slug && (
                  <Link
                    prefetch={false}
                    href={`/articles/${encodeURIComponent(item.slug)}?comment=${encodeURIComponent(item.id)}#comment-${encodeURIComponent(item.id)}`}
                    className={linkClass}
                  >
                    {copy.discussion}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {page?.nextCursor && filters ? (
        <Link
          prefetch={false}
          href={ownDiscussionHref(filters, page.nextCursor)}
          className="inline-flex min-h-11 items-center rounded-lg border border-base px-4 text-sm text-secondary"
        >
          {copy.next}
        </Link>
      ) : null}
    </div>
  );
}
