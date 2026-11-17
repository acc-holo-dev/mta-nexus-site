import { ServerContentEditorPage } from "../../../../../../features/servers/content-editor-server";
import { serverContentCopy } from "../../../../../../features/servers/server-content-copy";
import { getRequestLocale } from "../../../../../../lib/platform/i18n-server";

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
