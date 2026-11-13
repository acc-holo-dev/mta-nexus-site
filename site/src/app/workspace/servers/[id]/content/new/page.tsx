import { ServerContentEditorPage } from "../../../../../../components/server-content-editor-page";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { serverContentCopy } from "../../../../../../lib/server-content-copy";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: serverContentCopy(await getRequestLocale()).new,
    robots: { index: false, follow: false },
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <div className={pageShellClass}>{await ServerContentEditorPage(await params)}</div>;
}
