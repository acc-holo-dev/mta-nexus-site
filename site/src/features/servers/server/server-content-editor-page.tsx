import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

import { authService } from "../../../lib/services/accounts/auth-service";
import { serverContentService } from "../../../lib/services/servers/server-content-service";
import { AuthorContentForm } from "../../community/author-content-form";
import { parseEditableContent } from "../../community/user-platform-client";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax3xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { serverContentId } from "../server-content-api";
import { serverContentCopy, serverContentMutationError } from "../server-content-copy";
import { serverPublicationHistoryCopy } from "../server-publication-history-copy";
export async function serverContentEditorMetadata(): Promise<Metadata> {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).edit,
    robots: { index: false, follow: false },
  };
}

export async function ServerContentEditorPage({
  id,
  contentId,
}: {
  id: string;
  contentId?: string;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = serverContentCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.unavailable}
        retryHref={"/workspace/servers/"}
      />
    );
  }

  const returnPath = contentId
    ? `/workspace/servers/${encodeURIComponent(id)}/content/${encodeURIComponent(contentId)}`
    : `/workspace/servers/${encodeURIComponent(id)}/content/new`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(async () => {
      const orgId = serverContentId(id);
      if (contentId) return serverContentService.get(orgId, actor, serverContentId(contentId));
      return {
        server: await serverContentService.context(orgId, actor),
        content: null,
      };
    })
    .catch((error: unknown) => {
      failure =
        error instanceof AppError
          ? serverContentMutationError(locale, error.code)
          : copy.unavailable;
      return null;
    });
  const initial = result?.content ? parseEditableContent(result.content) : null;
  const path = `/workspace/servers/${encodeURIComponent(id)}/content`;
  return (
    <div className={pageShellClass}>
      <Link href={path} className={linkAccentSm}>
        {team.title}
      </Link>
      <h1 className="font-display text-primary">{contentId ? copy.edit : team.new}</h1>
      {result && (!contentId || (initial && initial.serverId === id)) ? (
        <>
          {contentId && (
            <Link
              href={`${path}/${encodeURIComponent(contentId)}/history`}
              className={linkAccentSm}
            >
              {serverPublicationHistoryCopy(locale).history}
            </Link>
          )}
          <AuthorContentForm
            key={`${id}:${contentId ?? "new"}`}
            locale={locale}
            initial={initial ?? undefined}
            server={result.server}
          />
        </>
      ) : (
        <ErrorState
          title={failure}
          description={team.loadUnavailableHint}
          action={
            <Link
              href={contentId ? `${path}/${encodeURIComponent(contentId)}` : `${path}/new`}
              className={linkAccentSm}
            >
              {copy.retry}
            </Link>
          }
        />
      )}
    </div>
  );
}

export async function ServerContentNewRoutePage({ params }: { params: Promise<{ id: string }> }) {
  return ServerContentEditorPage(await params);
}

export async function ServerContentEditRoutePage({
  params,
}: {
  params: Promise<{ id: string; contentId: string }>;
}) {
  return ServerContentEditorPage(await params);
}
