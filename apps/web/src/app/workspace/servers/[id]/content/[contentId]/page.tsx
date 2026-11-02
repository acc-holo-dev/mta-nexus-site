import { ServerContentEditorPage } from "../../../../../../components/server-content-editor-page";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { getUserPlatformCopy } from "../../../../../../lib/user-platform-copy";
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
  return ServerContentEditorPage(await params);
}
