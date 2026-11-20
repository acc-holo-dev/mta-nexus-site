import type { Metadata } from "next";
import { getLicenseMaintenanceCopy } from "../../../../features/commerce/license-maintenance-i18n";
import { LicenseMaintenanceScreen } from "../../../../features/commerce/license-maintenance-server";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${getLicenseMaintenanceCopy(await getRequestLocale()).maintenance} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LicenseMaintenanceScreen({ searchParams });
}
