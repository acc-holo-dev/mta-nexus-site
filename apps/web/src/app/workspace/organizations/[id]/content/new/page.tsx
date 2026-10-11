import { OrganizationContentEditorPage } from "../../../../../../components/organization-content-editor-page";
import { organizationContentCopy } from "../../../../../../lib/organization-content-copy";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: organizationContentCopy(await getRequestLocale()).new,
    robots: { index: false, follow: false },
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return OrganizationContentEditorPage(await params);
}
