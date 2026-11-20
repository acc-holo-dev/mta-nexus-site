import { OrganizationCreateScreen } from "../../../../features/organizations/organization-create-server";
import { getOrganizationCopy } from "../../../../features/organizations/organization-workspace-copy";
import { getRequestLocale } from "../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: getOrganizationCopy(await getRequestLocale()).create,
    robots: { index: false, follow: false },
  };
}

export default async function Page() {
  return OrganizationCreateScreen();
}
