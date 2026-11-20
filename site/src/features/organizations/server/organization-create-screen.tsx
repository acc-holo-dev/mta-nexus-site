import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax3xlCompact as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { getOrganizationCopy } from "../organization-workspace-copy";
import { OrganizationProfileForm } from "../profile";
export async function organizationCreateMetadata(): Promise<Metadata> {
  return {
    title: getOrganizationCopy(await getRequestLocale()).create,
    robots: { index: false, follow: false },
  };
}

export async function OrganizationCreateScreen() {
  const locale = await getRequestLocale();
  const copy = getOrganizationCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.create}
        message={copy.unavailable}
        retryHref="/workspace/organizations/new"
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/organizations/new" />;
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/organizations" className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.create}</h1>
      <OrganizationProfileForm locale={locale} actorId={actor.id} />
    </div>
  );
}
