import Link from "next/link";
import { cookies } from "next/headers";
import { AuthorContentForm } from "../../../../components/author-content-form";
import { PlatformSignIn } from "../../../../components/content-catalog-controls";
import { authService } from "../../../../lib/services/auth-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getUserPlatformCopy } from "../../../../lib/user-platform-copy";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).create,
    robots: { index: false, follow: false },
  };
}
export default async function NewPublicationPage() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  if (!(await authService.getSession(store.get("nexus_session")?.value)))
    return <PlatformSignIn locale={locale} />;
  const copy = getUserPlatformCopy(locale);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/workspace/content" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.create}</h1>
      <AuthorContentForm locale={locale} />
    </div>
  );
}
