import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { profilePrivacyService } from "../../../lib/services/accounts/profile-privacy-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax3xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { ProfileChangeHistoryLink } from "../change-history";
import { ProfilePrivacyEditor } from "../profile";
import { editablePrivacySchema } from "../profile-privacy-contract";
import { profilePrivacyCopy } from "../profile-privacy-copy";

const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function settingsPrivacyMetadata(): Promise<Metadata> {
  return {
    title: profilePrivacyCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export async function SettingsPrivacyScreen() {
  const locale = await getRequestLocale(),
    copy = profilePrivacyCopy(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={getDictionary(locale).errors.message}
        retryHref={"/settings/privacy"}
      />
    );
  }

  if (!actor) return <PlatformSignIn locale={locale} returnPath="/settings/privacy" />;
  const initial = await profilePrivacyService
    .own(actor)
    .then((row) => editablePrivacySchema.parse(row))
    .catch(() => null);
  return (
    <div className={pageShellClass}>
      <ProfileChangeHistoryLink locale={locale} />
      <header className="space-y-2">
        <Link href="/settings" className={navLinkClass}>
          {copy.back}
        </Link>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
      </header>
      <ProfilePrivacyEditor key={actor.id} initial={initial} locale={locale} />
      {["developer", "admin"].includes(actor.role) && (
        <Link href="/settings/developer" className={navLinkClass}>
          {copy.professional}
        </Link>
      )}
    </div>
  );
}
