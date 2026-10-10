import { cookies } from "next/headers";
import { authService } from "../../../../lib/services/auth-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getOrganizationCopy } from "../../../../lib/organization-workspace-copy";
import { PlatformSignIn } from "../../../../components/content-catalog-controls";
import { OrganizationProfileForm } from "../../../../components/organization-profile-form";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: getOrganizationCopy(await getRequestLocale()).create,
    robots: { index: false, follow: false },
  };
}
export default async function NewOrganizationPage() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} />;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="font-display text-primary">{getOrganizationCopy(locale).create}</h1>
      <OrganizationProfileForm locale={locale} actorId={actor.id} />
    </div>
  );
}
