import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { AuthorContentForm } from "../../../../components/author-content-form";
import { PlatformSignIn } from "../../../../components/content-catalog-controls";
import { authService } from "../../../../lib/services/auth-service";
import { authorContentService } from "../../../../lib/services/author-content-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getUserPlatformCopy } from "../../../../lib/user-platform-copy";
import { parseEditableContent } from "../../../../lib/user-platform-client";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).edit,
    robots: { index: false, follow: false },
  };
}
export default async function EditPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const [locale, store, { id }] = await Promise.all([getRequestLocale(), cookies(), params]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} />;
  const copy = getUserPlatformCopy(locale);
  const item = await authorContentService.get(id, actor).catch((error) => {
    if (error instanceof AppError && error.statusCode === 404) notFound();
    return null;
  });
  const initial = item ? parseEditableContent(JSON.parse(JSON.stringify(item))) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/workspace/content" className="text-sm text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">{copy.edit}</h1>
      {initial ? (
        <AuthorContentForm locale={locale} initial={initial} />
      ) : (
        <p role="alert" className="text-sm text-danger">
          {copy.unavailable}
        </p>
      )}
    </div>
  );
}
