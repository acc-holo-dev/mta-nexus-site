import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PlatformSignIn } from "../../../../components/content-catalog-controls";
import { NewResourceForm } from "../../../../components/new-resource-form";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Submit resource | MTA NEXUS",
  robots: { index: false, follow: false },
};

export default async function NewResourcePage() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const actor = await authService.getSession(store.get("nexus_session")?.value).catch(() => null);
  if (!actor) return <PlatformSignIn locale={locale} returnPath="/workspace/resources/new" />;
  return <NewResourceForm key={actor.id} actorId={actor.id} />;
}
