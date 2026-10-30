import { AppError } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  ownDiscussionHref,
  parseOwnDiscussionQuery,
} from "../../../lib/discussion-workspace-contract";
import { ownDiscussionCopy, ownDiscussionError } from "../../../lib/discussion-workspace-copy";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/auth-service";
import { discussionWorkspaceService } from "../../../lib/services/discussion-workspace-service";
export const dynamic = "force-dynamic";
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
    copy = ownDiscussionCopy(locale);
  let authFailed = false;
  const actor = await authService
    .getSession((await cookies()).get("nexus_session")?.value)
    .catch(() => {
      authFailed = true;
      return null;
    });
  if (!actor)
    return (
      <div className="nexus-panel mx-auto max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        {authFailed ? (
          <>
            <p role="alert" className="text-sm text-danger">
              {copy.failed}
            </p>
            <a
              href="/workspace/discussions"
              className="inline-flex min-h-11 items-center text-sm text-accent underline"
            >
              {copy.reload}
            </a>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center text-sm text-accent underline"
          >
            {copy.signIn}
          </Link>
        )}
      </div>
    );
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
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
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/workspace"
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {copy.workspace}
      </Link>
      <header className="space-y-2 border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <p className="text-xs text-muted">{copy.privacy}</p>
      </header>
      <form
        action="/workspace/discussions"
        method="get"
        className="nexus-panel flex flex-wrap items-end gap-3 p-4"
      >
        <label className="min-w-40 flex-1 space-y-1 text-xs text-muted">
          {copy.query}
          <input
            type="search"
            name="q"
            maxLength={120}
            defaultValue={filters?.query ?? ""}
            className="nexus-input block min-h-11 w-full"
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          {copy.availability}
          <select
            name="availability"
            defaultValue={filters?.availability ?? ""}
            className="nexus-input block min-h-11"
          >
            <option value="">{copy.all}</option>
            <option value="available">{copy.available}</option>
            <option value="unavailable">{copy.unavailable}</option>
          </select>
        </label>
        <Button type="submit" className="min-h-11 font-semibold">
          {copy.search}
        </Button>
        <Link
          href="/workspace/discussions"
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
          {filters?.cursor || filters?.query || filters?.availability
            ? copy.emptyFiltered
            : copy.empty}
        </p>
      )}
      {page && (
        <ul className="space-y-3">
          {page.items.map((item) => (
            <li key={item.id} className="nexus-panel space-y-3 p-5">
              <h2 className="break-words font-semibold text-primary">
                {item.title ?? copy.hidden}
              </h2>
              <p className="whitespace-pre-wrap break-words text-sm text-secondary">{item.text}</p>
              <time className="text-xs text-muted" dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
              <div className="flex flex-wrap gap-3">
                <Link
                  prefetch={false}
                  href={`/workspace/discussions/${encodeURIComponent(item.id)}`}
                  className="inline-flex min-h-11 items-center text-sm text-accent underline"
                >
                  {copy.open}
                </Link>
                {item.slug && (
                  <Link
                    prefetch={false}
                    href={`/articles/${encodeURIComponent(item.slug)}?comment=${encodeURIComponent(item.id)}#comment-${encodeURIComponent(item.id)}`}
                    className="inline-flex min-h-11 items-center text-sm text-accent underline"
                  >
                    {copy.discussion}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {page?.nextCursor && filters && (
        <Link
          prefetch={false}
          href={ownDiscussionHref(filters, page.nextCursor)}
          className="inline-flex min-h-11 items-center rounded-lg border border-base px-4 text-sm text-secondary"
        >
          {copy.next}
        </Link>
      )}
    </div>
  );
}
