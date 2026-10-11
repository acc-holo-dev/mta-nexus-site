import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { PublicUserTrustPanel } from "../../../../components/public-user-trust";
import { publicUserTrustService } from "../../../../lib/services/public-user-trust-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { trustCopy } from "../../../../lib/public-user-trust-copy";
export const dynamic = "force-dynamic";
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
    copy = trustCopy(locale);
  if (!data)
    return (
      <div className="nexus-panel space-y-4 p-6">
        <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        <p role="alert" className="text-sm text-danger">
          {copy.unavailable}
        </p>
        <a
          href={`/users/${encodeURIComponent(username)}/trust`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.reload}
        </a>
        <Link
          href={`/users/${encodeURIComponent(username)}`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.back}
        </Link>
      </div>
    );
  return <PublicUserTrustPanel data={data} locale={locale} />;
}
