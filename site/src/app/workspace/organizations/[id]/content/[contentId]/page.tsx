import { OrganizationContentEditorPage } from "../../../../../../components/organization-content-editor-page";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { getUserPlatformCopy } from "../../../../../../lib/user-platform-copy";

export const dynamic = "force-dynamic";

const pageShellClass = "min-w-0 overflow-x-clip";

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
  return <div className={pageShellClass}>{await OrganizationContentEditorPage(await params)}</div>;
}
