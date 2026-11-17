import { OrganizationContentEditorPage } from "../../../../../../features/organizations/content-editor-server";
import { organizationContentCopy } from "../../../../../../features/organizations/organization-content-copy";
import { getRequestLocale } from "../../../../../../lib/i18n-server";

export const dynamic = "force-dynamic";

const pageShellClass = "min-w-0 overflow-x-clip";

export async function generateMetadata() {
  return {
    title: organizationContentCopy(await getRequestLocale()).new,
    robots: { index: false, follow: false },
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <div className={pageShellClass}>{await OrganizationContentEditorPage(await params)}</div>;
}
