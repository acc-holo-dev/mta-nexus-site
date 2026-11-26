import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { discussionWorkspaceService } from "../../../lib/services/community/discussion-workspace-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax3xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  ownDiscussionDetailHref,
  ownDiscussionHref,
  parseOwnDiscussionDetailQuery,
} from "../discussion-workspace-contract";
import { ownDiscussionCopy } from "../discussion-workspace-copy";
import { OwnDiscussionDetail } from "../own-discussion";
export async function ownCommentMetadata() {
  return {
    title: ownDiscussionCopy(await getRequestLocale()).open,
    robots: { index: false, follow: false },
  };
}

export async function OwnCommentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params,
    locale = await getRequestLocale(),
    copy = ownDiscussionCopy(locale),
    dictionary = getDictionary(locale);
  const rawSearchParams = (await searchParams) ?? {};
  const paramsForQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (Array.isArray(value)) for (const part of value) paramsForQuery.append(key, part);
    else if (value !== undefined) paramsForQuery.append(key, value);
  }
  const listFilters = parseOwnDiscussionDetailQuery(paramsForQuery);
  const listHref = listFilters ? ownDiscussionHref(listFilters) : "/workspace/discussions";
  const returnPath = listFilters
    ? ownDiscussionDetailHref(id, listFilters)
    : `/workspace/discussions/${encodeURIComponent(id)}`;
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
  if (paramsForQuery.size && !listFilters) {
    return (
      <div className={pageShellMax3xl}>
        <Link href="/workspace/discussions" className={linkAccentSm}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.invalid}
          description={copy.loadUnavailableHint}
          action={
            <Link href="/workspace/discussions" className={linkAccentSm}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const initial = await discussionWorkspaceService.own(actor, id).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    return null;
  });
  return (
    <div className={pageShellMax3xl}>
      <Link href={listHref} className={linkAccentSm}>
        {copy.back}
      </Link>
      {initial ? (
        <OwnDiscussionDetail
          key={`${initial.id}:${initial.revision}:${initial.available}`}
          initial={initial}
          locale={locale}
          listHref={listHref}
          recoveryHref={returnPath}
        />
      ) : (
        <ErrorState
          title={copy.failed}
          description={copy.loadUnavailableHint}
          action={
            <a href={returnPath} className={linkAccentSm}>
              {dictionary.errors.retry}
            </a>
          }
        />
      )}
    </div>
  );
}
