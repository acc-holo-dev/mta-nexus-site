import { OrganizationContentEditorPage } from "../../../../../../components/organization-content-editor-page";
import { getUserPlatformCopy } from "../../../../../../lib/user-platform-copy";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: getUserPlatformCopy(await getRequestLocale()).edit,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; contentId: string }>;
}) {
  return OrganizationContentEditorPage(await params);
}
