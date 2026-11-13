import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AuthorContentForm } from "../../../../components/author-content-form";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { getUserPlatformCopy } from "../../../../lib/user-platform-copy";

export const dynamic = "force-dynamic";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-6 overflow-x-clip";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).create,
    robots: { index: false, follow: false },
  };
}

export default async function NewPublicationPage() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  if (!(await authService.getSession(store.get("nexus_session")?.value)))
    return <PlatformSignIn locale={locale} returnPath="/workspace/content/new" />;
  const copy = getUserPlatformCopy(locale);
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/content" className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.create}</h1>
      <AuthorContentForm locale={locale} />
    </div>
  );
}
