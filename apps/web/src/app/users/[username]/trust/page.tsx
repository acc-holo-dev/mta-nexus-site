import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicUserTrustPanel } from "../../../../components/public-user-trust";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { trustCopy } from "../../../../lib/public-user-trust-copy";
import { publicUserTrustService } from "../../../../lib/services/public-user-trust-service";
export const dynamic = "force-dynamic";
const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip";
const actionLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const load = cache((username: string) =>
  publicUserTrustService.get(username).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    return null;
  }),
);
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const [locale, data] = await Promise.all([getRequestLocale(), load((await params).username)]),
    copy = trustCopy(locale);
  return data
    ? {
        title: `${copy.title} · ${data.user.displayName}`,
        description: copy.description,
        alternates: { canonical: `/users/${encodeURIComponent(data.user.username)}/trust` },
      }
    : { title: copy.title, robots: { index: false, follow: false } };
}
export default async function TrustPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params,
    locale = await getRequestLocale(),
    data = await load(username),
    copy = trustCopy(locale),
    dictionary = getDictionary(locale),
    href = `/users/${encodeURIComponent(username)}/trust`;
  if (!data)
    return (
      <div className={pageShellClass}>
        <header className="nexus-panel min-w-0 space-y-3 overflow-x-clip p-6">
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        </header>
        <ErrorState
          id="user-trust-unavailable"
          title={copy.unavailable}
          action={
            <a href={href} className={actionLinkClass}>
              {dictionary.errors.retry}
            </a>
          }
        />
        <Link href={`/users/${encodeURIComponent(username)}`} className={actionLinkClass}>
          {copy.back}
        </Link>
      </div>
    );
  return <PublicUserTrustPanel data={data} locale={locale} />;
}
