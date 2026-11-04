import { cookies } from "next/headers";
import Link from "next/link";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { RegisterServerForm } from "../../../../components/register-server-form";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getManagedServerCopy } from "../../../../lib/managed-server-view";
import { authService } from "../../../../lib/services/auth-service";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-2xl space-y-5 overflow-x-clip px-4 py-8 sm:px-0";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata() {
  const copy = getDictionary(await getRequestLocale()).serverRegistration;
  return {
    title: copy.title,
    description: copy.description,
    robots: { index: false, follow: false },
  };
}

export default async function RegisterServerPage() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const actor = await authService.getSession(store.get("nexus_session")?.value).catch(() => null);
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/servers/new" />;
  const copy = getManagedServerCopy(locale);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/servers" className={navLinkClass}>
        ← {copy.title}
      </Link>
      <RegisterServerForm />
    </div>
  );
}
