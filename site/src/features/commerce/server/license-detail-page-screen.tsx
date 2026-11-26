import { AppError } from "@nexus/domain";
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
import { LicenseControlPanel } from "../components/license-control-panel";
import {
  licenseArchiveDetailHref,
  licenseArchiveListHref,
  licenseArchivePageQuery,
} from "../license-archive-query";
import { getLicenseControlCopy } from "../license-control-i18n";
import { LicenseDetailView } from "./license-detail-view";

type Query = Record<string, string | string[] | undefined>;

export async function licenseDetailPageMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

async function LicenseDetailPageScreen({ licenseId, query }: { licenseId: string; query: Query }) {
  const [store, locale] = await Promise.all([cookies(), getRequestLocale()]);
  const copy = getLicenseControlCopy(locale);
  const dictionary = getDictionary(locale);
  let filters: ReturnType<typeof licenseArchivePageQuery>;
  try {
    filters = licenseArchivePageQuery(query);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 400) notFound();
    throw error;
  }
  const listHref = licenseArchiveListHref(filters);
  const retryHref = licenseArchiveDetailHref(licenseId, filters);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={listHref}
      />
    );
  }

  if (!user) return <PlatformSignIn locale={locale} returnPath={retryHref} />;
  let license: Awaited<ReturnType<typeof licenseControlService.detail>> = null;
  let servers: Awaited<ReturnType<typeof licenseControlService.servers>> | undefined;
  try {
    license = await licenseControlService.detail(user, licenseId);
    if (license?.canActivate && !license.boundServerId) {
      servers = await licenseControlService.servers(user, licenseId);
    }
  } catch {
    return (
      <div className={pageShellMax4xl}>
        <Link href={listHref} className={linkAccentSmRounded}>
          {copy.back}
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
        {copy.back}
      </Link>
      <LicenseDetailView license={license} locale={locale} />
      <LicenseControlPanel
        key={`${user.id}:${license.id}`}
        actorId={user.id}
        license={{
          id: license.id,
          status: license.status,
          effectiveStatus: license.effectiveStatus,
          canActivate: license.canActivate,
          bindingReady: license.bindingReady,
          boundServerId: license.boundServerId,
          updatedAt: license.updatedAt.toISOString(),
          expiresAt: license.expiresAt?.toISOString() ?? null,
          canRefreshBinding: license.canRefreshBinding,
          currentEndpointRevision: license.currentEndpointRevision,
        }}
        initialServers={servers}
      />
      <Link
        href={`/workspace/licenses/${encodeURIComponent(licenseId)}/history`}
        className={linkAccentSmRounded}
      >
        {copy.fullHistory}
      </Link>
    </div>
  );
}

export async function WorkspaceLicenseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return LicenseDetailPageScreen({ licenseId: id, query });
}
