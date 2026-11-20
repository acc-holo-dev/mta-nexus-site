import { EmptyState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { verificationWorkspaceService } from "../../../lib/services/moderation/verification-workspace-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax3xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { type2xlBoldPrimary, typeMt2SmMuted } from "../../shell/type-shell";
import { editableDeveloperSchema } from "../../trust/verification-workspace-contract";
import { verificationCopy } from "../../trust/verification-workspace-copy";
import { ProfileChangeHistoryLink } from "../change-history";
import { DeveloperProfileEditor } from "../profile";
import { profilePrivacyCopy } from "../profile-privacy-copy";
export async function settingsDeveloperMetadata(): Promise<Metadata> {
  return {
    title: verificationCopy(await getRequestLocale()).profile,
    robots: { index: false, follow: false },
  };
}

export async function SettingsDeveloperScreen() {
  const locale = await getRequestLocale(),
    copy = verificationCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/settings/developer"}
      />
    );
  }

  if (!actor) return <PlatformSignIn locale={locale} returnPath="/settings/developer" />;
  if (!["developer", "admin"].includes(actor.role))
    return (
      <div className={pageShellMax3xl}>
        <EmptyState
          title={copy.roleRequired}
          description={copy.profileDescription}
          action={
            <Link href="/settings" className={linkAccentSm}>
              {profilePrivacyCopy(locale).back}
            </Link>
          }
        />
      </div>
    );
  const initial = await verificationWorkspaceService
    .ownProfile(actor)
    .then((value) => editableDeveloperSchema.parse(value))
    .catch(() => null);
  return (
    <div className={pageShellMax3xl}>
      <ProfileChangeHistoryLink locale={locale} />
      <header>
        <h1 className={type2xlBoldPrimary}>{copy.profile}</h1>
        <p className={typeMt2SmMuted}>{copy.profileDescription}</p>
      </header>
      <DeveloperProfileEditor key={actor.id} actorId={actor.id} initial={initial} locale={locale} />
      <Link href="/settings/privacy" className={linkAccentSm}>
        {profilePrivacyCopy(locale).title}
      </Link>
    </div>
  );
}
