import { ProfileChangeHistoryLink } from "../../../components/private-change-history-controls";
import { cookies } from "next/headers";
import Link from "next/link";
import { DeveloperProfileEditor } from "../../../components/developer-profile-editor";
import { authService } from "../../../lib/services/auth-service";
import { verificationWorkspaceService } from "../../../lib/services/verification-workspace-service";
import { getRequestLocale } from "../../../lib/i18n-server";
import { verificationCopy } from "../../../lib/verification-workspace-copy";
import { editableDeveloperSchema } from "../../../lib/verification-workspace-contract";
import { profilePrivacyCopy } from "../../../lib/profile-privacy-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: verificationCopy(await getRequestLocale()).profile,
    robots: { index: false, follow: false },
  };
}
export default async function DeveloperSettingsPage() {
  const locale = await getRequestLocale(),
    copy = verificationCopy(locale),
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  if (!actor)
    return (
      <div className="nexus-panel p-8">
        <Link className="text-accent underline" href="/auth/login">
          {copy.signIn}
        </Link>
      </div>
    );
  if (!["developer", "admin"].includes(actor.role))
    return <div className="nexus-panel p-8 text-sm text-muted">{copy.roleRequired}</div>;
  const initial = await verificationWorkspaceService
    .ownProfile(actor)
    .then((value) => editableDeveloperSchema.parse(value))
    .catch(() => null);
  return (
    <div className="space-y-6">
      <ProfileChangeHistoryLink locale={locale} />
      <header>
        <h1 className="text-2xl font-bold text-primary">{copy.profile}</h1>
        <p className="mt-2 text-sm text-muted">{copy.profileDescription}</p>
      </header>
      <DeveloperProfileEditor key={actor.id} initial={initial} locale={locale} />
      <Link
        href="/settings/privacy"
        className="inline-flex min-h-11 items-center text-sm text-accent underline"
      >
        {profilePrivacyCopy(locale).title}
      </Link>
    </div>
  );
}
