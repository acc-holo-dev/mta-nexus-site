import { cookies } from "next/headers";
import Link from "next/link";
import { OrganizationProfileForm } from "../../../../components/organization-profile-form";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getOrganizationCopy } from "../../../../lib/organization-workspace-copy";
import { authService } from "../../../../lib/services/auth-service";
export const dynamic = "force-dynamic";
const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-5 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata() {
  return {
    title: getOrganizationCopy(await getRequestLocale()).create,
    robots: { index: false, follow: false },
  };
}
export default async function NewOrganizationPage() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/organizations/new" />;
  const copy = getOrganizationCopy(locale);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/organizations" className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.create}</h1>
      <OrganizationProfileForm locale={locale} actorId={actor.id} />
    </div>
  );
}
