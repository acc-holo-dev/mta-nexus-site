import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getUserPlatformCopy } from "../../../../features/community/user-platform-copy";
import { NewResourceForm } from "../../../../features/resources/create-controls";
import { PlatformSignIn } from "../../../../features/shell/guest-auth";
import { PlatformSessionError } from "../../../../features/shell/session-error";
import { getDictionary } from "../../../../lib/platform/i18n";
import { getRequestLocale } from "../../../../lib/platform/i18n-server";
import { authService } from "../../../../lib/services/accounts/auth-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Submit resource | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function NewResourcePage() {
  const locale = await getRequestLocale();
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    const dictionary = getDictionary(locale);
    return (
      <PlatformSessionError
        locale={locale}
        title={dictionary.publishing.resourceTitle}
        message={getUserPlatformCopy(locale).unavailable}
        retryHref="/workspace/resources/new"
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/resources/new" />;
  return (
    <div className="min-w-0 overflow-x-clip">
      <NewResourceForm key={actor.id} actorId={actor.id} />
    </div>
  );
}
