import type { Metadata } from "next";
import { StaffStorageScreen } from "../../../features/moderation/staff-storage-server";
import { storageMaintenanceCopy } from "../../../features/moderation/storage-maintenance-i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${storageMaintenanceCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return StaffStorageScreen(props);
}
