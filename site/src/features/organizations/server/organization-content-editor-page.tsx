import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { organizationContentService } from "../../../lib/services/organizations/organization-content-service";
import { AuthorContentForm } from "../../community/author-content-form";
import { parseEditableContent } from "../../community/user-platform-client";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax3xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { organizationContentId } from "../organization-content-api";
import {
  organizationContentCopy,
  organizationContentMutationError,
} from "../organization-content-copy";
import { organizationPublicationHistoryCopy } from "../organization-publication-history-copy";
import { organizationReturnPath } from "./organization-return-path";

import { linkAccentSm } from "../../shell/link-shell";
export async function organizationContentEditorMetadata(): Promise<Metadata> {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).edit,
    robots: { index: false, follow: false },
  };
}

export async function OrganizationContentEditorPage({
  id,
  contentId,
}: {
  id: string;
  contentId?: string;
}) {
  const locale = await getRequestLocale(),
    copy = getUserPlatformCopy(locale),
    team = organizationContentCopy(locale);
  const safeContentId =
    contentId && /^[a-zA-Z0-9_-]{1,128}$/u.test(contentId) ? contentId : undefined;
  const returnPath = organizationReturnPath(
    id,
    contentId && !safeContentId ? "content" : `content/${safeContentId ?? "new"}`,
  );
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={contentId ? copy.edit : team.new}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let failure = copy.unavailable;
  const result = await Promise.resolve()
    .then(async () => {
      const orgId = organizationContentId(id);
      if (contentId)
        return organizationContentService.get(orgId, actor, organizationContentId(contentId));
      return {
        organization: await organizationContentService.context(orgId, actor),
        content: null,
      };
    })
    .catch((error: unknown) => {
      failure =
        error instanceof AppError
          ? organizationContentMutationError(locale, error.code)
          : copy.unavailable;
      return null;
    });
  const initial = result?.content ? parseEditableContent(result.content) : null;
  const path = `/workspace/organizations/${encodeURIComponent(id)}/content`;
  return (
    <div className={pageShellClass}>
      <Link href={path} className={linkAccentSm}>
        {team.title}
      </Link>
      <h1 className="font-display text-primary">{contentId ? copy.edit : team.new}</h1>
      {contentId && initial && (
        <Link href={`${path}/${encodeURIComponent(contentId)}/history`} className={linkAccentSm}>
          {organizationPublicationHistoryCopy(locale).history}
        </Link>
      )}
      {result && (!contentId || (initial && initial.organizationId === id)) ? (
        <AuthorContentForm
          key={`${id}:${contentId ?? "new"}`}
          locale={locale}
          initial={initial ?? undefined}
          organization={result.organization}
        />
      ) : (
        <ErrorState
          title={failure}
          description={copy.unavailableHint}
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
