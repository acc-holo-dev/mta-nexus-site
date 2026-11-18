import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLicenseControlCopy } from "../../../../features/commerce/license-control-i18n";
import { LicenseControlPanel } from "../../../../features/commerce/license-controls";
import { LicenseDetailView } from "../../../../features/commerce/license-detail";
import { PlatformSignIn } from "../../../../features/shell/guest-auth";
import { PlatformSessionError } from "../../../../features/shell/session-error";

import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { authService } from "../../../../lib/services/accounts/auth-service";
import { licenseControlService } from "../../../../lib/services/commerce/license-control-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Manage license | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function LicensePage({ params }: { params: Promise<{ id: string }> }) {
  const [store, locale, { id }] = await Promise.all([cookies(), getRequestLocale(), params]);
  const copy = getLicenseControlCopy(locale);
  const dictionary = getDictionary(locale);
  const retryHref = `/workspace/licenses/${encodeURIComponent(id)}`;
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
        returnPath={`/workspace/licenses/${encodeURIComponent(id)}`}
      />
    );
  let license: Awaited<ReturnType<typeof licenseControlService.detail>> = null;
  let servers: Awaited<ReturnType<typeof licenseControlService.servers>> | undefined;
  try {
    license = await licenseControlService.detail(user, id);
    if (license?.canActivate && !license.boundServerId) {
      servers = await licenseControlService.servers(user, id);
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
      <Link href={`/workspace/licenses/${encodeURIComponent(id)}/history`} className={navLinkClass}>
        {copy.fullHistory}
      </Link>
    </div>
  );
}
