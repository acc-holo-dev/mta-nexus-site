import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { can } from "@nexus/security";
import { authService } from "../../../../lib/services/auth-service";
import { licenseControlService } from "../../../../lib/services/license-control-service";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getLicenseControlCopy } from "../../../../lib/license-control-i18n";
import { LicenseControlPanel } from "../../../../components/license-control-panel";
import { LicenseDetailView } from "../../../../components/license-detail-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "License moderation | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ModerateLicensePage({ params }: { params: Promise<{ id: string }> }) {
  const [store, locale, { id }] = await Promise.all([cookies(), getRequestLocale(), params]);
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user || !can(user, "admin.moderation")) notFound();
  const license = await licenseControlService.moderationDetail(user, id);
  if (!license) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <Link href="/admin/licenses" className="text-sm text-accent underline">
        {getLicenseControlCopy(locale).moderation}
      </Link>
      <LicenseDetailView license={license} locale={locale} />
      <LicenseControlPanel
        key={license.id}
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
        className="text-sm text-accent underline"
      >
        {getLicenseControlCopy(locale).fullHistory}
      </Link>
    </div>
  );
}
