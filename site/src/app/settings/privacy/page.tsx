import { cookies } from "next/headers";
import Link from "next/link";
import { ProfileChangeHistoryLink } from "../../../features/accounts/change-history";
import { ProfilePrivacyEditor } from "../../../features/accounts/profile";
import { editablePrivacySchema } from "../../../features/accounts/profile-privacy-contract";
import { profilePrivacyCopy } from "../../../features/accounts/profile-privacy-copy";
import { PlatformSignIn } from "../../../features/shell/guest-auth";
import { PlatformSessionError } from "../../../features/shell/session-error";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

import { authService } from "../../../lib/services/accounts/auth-service";
import { profilePrivacyService } from "../../../lib/services/accounts/profile-privacy-service";
export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata() {
  return {
    title: profilePrivacyCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function PrivacySettingsPage() {
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
