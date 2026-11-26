import { can } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { licenseControlService } from "../../../lib/services/commerce/license-control-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  licenseModerationDetailHref,
  licenseModerationListHref,
  licenseModerationQuery,
} from "../license-archive-query";
import { getLicenseControlCopy } from "../license-control-i18n";
import { LicenseControlPanel } from "../license-controls";
import { LicenseDetailView } from "../license-detail";

type Query = Record<string, string | string[] | undefined>;

export async function licenseModerationDetailMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).moderation} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LicenseModerationDetailScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const [store, locale, { id }, query] = await Promise.all([
    cookies(),
    getRequestLocale(),
    params,
    searchParams,
  ]);
  const copy = getLicenseControlCopy(locale);
  const dictionary = getDictionary(locale);
  const filters = licenseModerationQuery(query);
  const listHref = licenseModerationListHref(filters);
  const retryHref = licenseModerationDetailHref(id, filters);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={dictionary.errors.title}
        message={copy.loadUnavailable}
        retryHref={listHref}
      />
    );
  }

  if (!user) return <PlatformSignIn locale={locale} returnPath={retryHref} />;
  if (!can(user, "admin.moderation")) notFound();
  let license: Awaited<ReturnType<typeof licenseControlService.moderationDetail>> = null;
  try {
    license = await licenseControlService.moderationDetail(user, id);
  } catch {
    return (
      <div className={pageShellMax4xl}>
        <Link href={listHref} className={linkAccentSmRounded}>
          {copy.moderation}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={retryHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  if (!license) notFound();
  return (
    <div className={pageShellMax4xl}>
      <Link href={listHref} className={linkAccentSmRounded}>
        {copy.moderation}
      </Link>
      <LicenseDetailView license={license} locale={locale} />
      <LicenseControlPanel
        key={`${user.id}:${license.id}`}
        actorId={user.id}
        moderation
        license={{
          id: license.id,
          status: license.status,
          effectiveStatus: license.effectiveStatus,
          canActivate: license.canActivate,
          bindingReady: license.bindingReady,
          boundServerId: license.boundServerId,
          updatedAt: license.updatedAt.toISOString(),
          expiresAt: license.expiresAt?.toISOString() ?? null,
        }}
      />
      <Link
        href={`/admin/licenses/${encodeURIComponent(id)}/history`}
        className={linkAccentSmRounded}
      >
        {copy.fullHistory}
      </Link>
    </div>
  );
}
