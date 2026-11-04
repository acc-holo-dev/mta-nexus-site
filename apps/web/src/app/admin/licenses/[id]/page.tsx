import { can } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LicenseControlPanel } from "../../../../components/license-control-panel";
import { LicenseDetailView } from "../../../../components/license-detail-view";
import { PlatformSignIn } from "../../../../components/platform-sign-in";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { getLicenseControlCopy } from "../../../../lib/license-control-i18n";
import { authService } from "../../../../lib/services/auth-service";
import { licenseControlService } from "../../../../lib/services/license-control-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "License moderation | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ModerateLicensePage({ params }: { params: Promise<{ id: string }> }) {
  const [store, locale, { id }] = await Promise.all([cookies(), getRequestLocale(), params]);
  const copy = getLicenseControlCopy(locale);
  const dictionary = getDictionary(locale);
  const retryHref = `/admin/licenses/${encodeURIComponent(id)}`;
  const user = await authService.getSession(store.get("nexus_session")?.value);
  if (!user)
    return (
      <PlatformSignIn locale={locale} returnPath={`/admin/licenses/${encodeURIComponent(id)}`} />
    );
  if (!can(user, "admin.moderation")) notFound();
  let license: Awaited<ReturnType<typeof licenseControlService.moderationDetail>> = null;
  try {
    license = await licenseControlService.moderationDetail(user, id);
  } catch {
    return (
      <div className={pageShellClass}>
        <Link href="/admin/licenses" className={navLinkClass}>
          {copy.moderation}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
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
      <Link href="/admin/licenses" className={navLinkClass}>
        {copy.moderation}
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
      <Link href={`/admin/licenses/${encodeURIComponent(id)}/history`} className={navLinkClass}>
        {copy.fullHistory}
      </Link>
    </div>
  );
}
