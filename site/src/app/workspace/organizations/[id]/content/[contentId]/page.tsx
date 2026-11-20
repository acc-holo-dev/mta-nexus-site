import {
  OrganizationContentEditorPage,
  organizationContentEditorMetadata,
} from "../../../../../../features/organizations/content-editor-server";

export const dynamic = "force-dynamic";

export const generateMetadata = organizationContentEditorMetadata;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; contentId: string }>;
}) {
  return OrganizationContentEditorPage(await params);
}
