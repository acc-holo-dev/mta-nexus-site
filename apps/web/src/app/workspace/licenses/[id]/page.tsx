import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { LicenseControlPanel } from "../../../../components/license-control-panel";
import { LicenseDetailView } from "../../../../components/license-detail-view";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getLicenseControlCopy } from "../../../../lib/license-control-i18n";
import { authService } from "../../../../lib/services/auth-service";
import { licenseControlService } from "../../../../lib/services/license-control-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Manage license | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function LicensePage({ params }: { params: Promise<{ id: string }> }) {
  const [store, locale, { id }] = await Promise.all([cookies(), getRequestLocale(), params]);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/licenses/${encodeURIComponent(id)}`}
      />
    );
  const license = await licenseControlService.detail(user, id);
  if (!license) notFound();
  const servers =
    license.canActivate && !license.boundServerId
      ? await licenseControlService.servers(user, id)
      : undefined;
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link
        href="/workspace/licenses"
        className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {getLicenseControlCopy(locale).back}
      </Link>
      <LicenseDetailView license={license} locale={locale} />
      <LicenseControlPanel
        key={license.id}
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
        href={`/workspace/licenses/${encodeURIComponent(id)}/history`}
        className="text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {getLicenseControlCopy(locale).fullHistory}
      </Link>
    </div>
  );
}
