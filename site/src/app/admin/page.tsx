import { AdminHomeScreen, adminHomeMetadata } from "../../features/moderation/admin-home-server";

export const dynamic = "force-dynamic";

export const generateMetadata = adminHomeMetadata;

export default async function Page(props: {
  searchParams: Promise<{
    reportView?: string;
    reportPage?: string;
    reportId?: string;
    verificationView?: string;
    verificationPage?: string;
    verificationId?: string;
    buildPage?: string;
    riskBuildPage?: string;
    contentPage?: string;
  }>;
}) {
  return AdminHomeScreen(props);
}
