import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClass } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { discussionWorkspaceService } from "../../../lib/services/community/discussion-workspace-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkSecondaryBorder } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelClipSpace3P5, panelFlexMinWrapEndP4 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  type2xlExtraboldPrimary,
  typeFlexMinWrapGap3,
  typeMinBreakSemiboldPrimary,
  typeMinH11Semibold,
  typeMinSpace3,
  typeMinW40Flex1Space1XsMuted,
  typePrewrapSmSecondary,
  typeSmMuted,
  typeSpace1XsMuted,
  typeXsMuted,
} from "../../shell/type-shell";
import { ownDiscussionHref, parseOwnDiscussionQuery } from "../discussion-workspace-contract";
import { ownDiscussionCopy, ownDiscussionError } from "../discussion-workspace-copy";

export async function ownDiscussionsMetadata() {
  const copy = ownDiscussionCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export async function OwnDiscussionsPage({
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
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.title}
        message={copy.failed}
        retryHref={returnPath}
      />
    );
  }
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
    <div className={pageShellMax4xl}>
      <Link href="/workspace" className={linkAccentSm}>
        {copy.workspace}
      </Link>
      <header className="min-w-0 space-y-2 border-b border-base pb-6">
        <h1 className={type2xlExtraboldPrimary}>{copy.title}</h1>
        <p className={typeSmMuted}>{copy.description}</p>
        <p className={typeXsMuted}>{copy.privacy}</p>
      </header>
      <search aria-label={copy.filters}>
        <form action="/workspace/discussions" method="get" className={panelFlexMinWrapEndP4}>
          <label className={typeMinW40Flex1Space1XsMuted}>
            {copy.query}
            <input
              type="search"
              name="q"
              maxLength={120}
              defaultValue={filters?.query ?? ""}
              className={`${fieldClass} block min-h-11 w-full`}
            />
          </label>
          <label className={typeSpace1XsMuted}>
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
          <Button type="submit" className={typeMinH11Semibold}>
            {copy.search}
          </Button>
          <Link href="/workspace/discussions" className={linkAccentSm}>
            {copy.reset}
          </Link>
        </form>
      </search>
      <a href={latest} className={linkAccentSm}>
        {copy.latest}
      </a>
      {error ? (
        <ErrorState
          title={error}
          description={copy.loadUnavailableHint}
          action={
            <a href={latest} className={linkAccentSm}>
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
              <Link href="/workspace/discussions" className={linkAccentSm}>
                {copy.reset}
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {page?.items.length ? (
        <ul className={typeMinSpace3}>
          {page.items.map((item) => (
            <li key={item.id} className={panelClipSpace3P5}>
              <h2 className={typeMinBreakSemiboldPrimary}>{item.title ?? copy.hidden}</h2>
              <p className={typePrewrapSmSecondary}>{item.text}</p>
              <time className={typeXsMuted} dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
                  timeZone: "UTC",
                  timeZoneName: "short",
                })}
              </time>
              <div className={typeFlexMinWrapGap3}>
                <Link
                  prefetch={false}
                  href={`/workspace/discussions/${encodeURIComponent(item.id)}`}
                  className={linkAccentSm}
                >
                  {copy.open}
                </Link>
                {item.slug && (
                  <Link
                    prefetch={false}
                    href={`/articles/${encodeURIComponent(item.slug)}?comment=${encodeURIComponent(item.id)}#comment-${encodeURIComponent(item.id)}`}
                    className={linkAccentSm}
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
          className={linkSecondaryBorder}
        >
          {copy.next}
        </Link>
      ) : null}
    </div>
  );
}
