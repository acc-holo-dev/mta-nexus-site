import type { Metadata } from "next";
import { StaffStorageObjectScreen } from "../../../../../features/moderation/staff-storage-object-server";
import { storageMaintenanceCopy } from "../../../../../features/moderation/storage-maintenance-i18n";
import { getRequestLocale } from "../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${storageMaintenanceCopy(await getRequestLocale()).detail} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return StaffStorageObjectScreen(props);
}
