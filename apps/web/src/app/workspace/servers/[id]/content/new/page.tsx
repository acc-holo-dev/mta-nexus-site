import { ServerContentEditorPage } from "../../../../../../components/server-content-editor-page";
import { serverContentCopy } from "../../../../../../lib/server-content-copy";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: serverContentCopy(await getRequestLocale()).new,
    robots: { index: false, follow: false },
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return ServerContentEditorPage(await params);
}
