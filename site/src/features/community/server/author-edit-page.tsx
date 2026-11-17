import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/platform/i18n";
import { getRequestLocale } from "../../../lib/platform/i18n-server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { authorContentService } from "../../../lib/services/organizations/author-content-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { PlatformSessionError } from "../../shell/session-error";
import { AuthorContentForm } from "../author-content-form";
import { parseEditableContent } from "../user-platform-client";
import { getUserPlatformCopy } from "../user-platform-copy";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).edit,
    robots: { index: false, follow: false },
  };
}

export default async function EditPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const [locale, { id }] = await Promise.all([getRequestLocale(), params]);
  const returnPath = `/workspace/content/${encodeURIComponent(id)}`;
  const copy = getUserPlatformCopy(locale);
  const dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.edit}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  const item = await authorContentService.get(id, actor).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  const initial = item ? parseEditableContent(JSON.parse(JSON.stringify(item))) : null;
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/content" className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.edit}</h1>
      {initial ? (
        <AuthorContentForm locale={locale} initial={initial} />
      ) : (
        <ErrorState
          title={copy.unavailable}
          description={copy.unavailableHint}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      )}
    </div>
  );
}
