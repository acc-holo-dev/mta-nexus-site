import {
  LicenseDetailPageScreen,
  licenseDetailPageMetadata,
} from "../../../../features/commerce/license-detail-page-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => licenseDetailPageMetadata();
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return LicenseDetailPageScreen({ licenseId: id });
}
