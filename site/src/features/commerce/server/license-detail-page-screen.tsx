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
import { PlatformSessionError } from "../../shell/session-error";
import { LicenseControlPanel } from "../components/license-control-panel";
import { getLicenseControlCopy } from "../license-control-i18n";
import { LicenseDetailView } from "./license-detail-view";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function licenseDetailPageMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseControlCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LicenseDetailPageScreen({ licenseId }: { licenseId: string }) {
  const [store, locale] = await Promise.all([cookies(), getRequestLocale()]);
  const copy = getLicenseControlCopy(locale);
  const dictionary = getDictionary(locale);
  const retryHref = `/workspace/licenses/${encodeURIComponent(licenseId)}`;
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/workspace/licenses/"}
      />
    );
  }

  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/licenses/${encodeURIComponent(licenseId)}`}
      />
    );
  let license: Awaited<ReturnType<typeof licenseControlService.detail>> = null;
  let servers: Awaited<ReturnType<typeof licenseControlService.servers>> | undefined;
  try {
    license = await licenseControlService.detail(user, licenseId);
    if (license?.canActivate && !license.boundServerId) {
      servers = await licenseControlService.servers(user, licenseId);
    }
  } catch {
    return (
      <div className={pageShellClass}>
        <Link href="/workspace/licenses" className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={retryHref} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  if (!license) notFound();
  return (
    <div className={pageShellClass}>
      <Link href="/workspace/licenses" className={navLinkClass}>
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
        className={navLinkClass}
      >
        {copy.fullHistory}
      </Link>
    </div>
  );
}
