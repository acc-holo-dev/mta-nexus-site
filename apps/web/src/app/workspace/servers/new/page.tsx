import { cookies } from "next/headers";
import { PlatformSignIn } from "../../../../components/content-catalog-controls";
import { RegisterServerForm } from "../../../../components/register-server-form";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";

export const dynamic = "force-dynamic";

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
  return <RegisterServerForm />;
}
