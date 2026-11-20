import {
  LicenseMaintenanceScreen,
  licenseMaintenanceMetadata,
} from "../../../../features/commerce/license-maintenance-server";

export const dynamic = "force-dynamic";

export const generateMetadata = licenseMaintenanceMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LicenseMaintenanceScreen({ searchParams });
}
