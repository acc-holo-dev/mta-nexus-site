import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../components/platform-sign-in";
import { ProfileChangeHistoryLink } from "../../../components/private-change-history-controls";
import { ProfilePrivacyEditor } from "../../../components/profile-privacy-editor";
import { getRequestLocale } from "../../../lib/i18n-server";
import { editablePrivacySchema } from "../../../lib/profile-privacy-contract";
import { profilePrivacyCopy } from "../../../lib/profile-privacy-copy";
import { authService } from "../../../lib/services/auth-service";
import { profilePrivacyService } from "../../../lib/services/profile-privacy-service";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: profilePrivacyCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export default async function PrivacySettingsPage() {
  const locale = await getRequestLocale(),
    copy = profilePrivacyCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/settings/privacy" />;
  const initial = await profilePrivacyService
    .own(actor)
    .then((row) => editablePrivacySchema.parse(row))
    .catch(() => null);
  return (
    <div className="space-y-6">
      <ProfileChangeHistoryLink locale={locale} />
      <header className="space-y-2">
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.back}
        </Link>
        <h1 className="text-2xl font-bold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
      </header>
      <ProfilePrivacyEditor key={actor.id} initial={initial} locale={locale} />
      {["developer", "admin"].includes(actor.role) && (
        <Link
          href="/settings/developer"
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.professional}
        </Link>
      )}
    </div>
  );
}
