import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { publicUserTrustService } from "../../../lib/services/trust/public-user-trust-service";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xlTight as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace3P6 } from "../../shell/panel-shell";
import { PublicUserTrustPanel } from "../public-user-trust";
import { trustCopy } from "../public-user-trust-copy";

const load = cache((username: string) =>
  publicUserTrustService.get(username).catch((error: unknown) => {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    return null;
  }),
);

export async function userTrustMetadata({ params }: { params: Promise<{ username: string }> }) {
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

export async function TrustPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params,
    locale = await getRequestLocale(),
    data = await load(username),
    copy = trustCopy(locale),
    dictionary = getDictionary(locale),
    href = `/users/${encodeURIComponent(username)}/trust`;
  if (!data)
    return (
      <div className={pageShellClass}>
        <header className={panelClipSpace3P6}>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
        </header>
        <ErrorState
          title={copy.unavailable}
          description={copy.unavailableHint}
          action={
            <a href={href} className={linkAccentSm}>
              {dictionary.errors.retry}
            </a>
          }
        />
        <Link href={`/users/${encodeURIComponent(username)}`} className={linkAccentSm}>
          {copy.back}
        </Link>
      </div>
    );
  return <PublicUserTrustPanel data={data} locale={locale} />;
}
