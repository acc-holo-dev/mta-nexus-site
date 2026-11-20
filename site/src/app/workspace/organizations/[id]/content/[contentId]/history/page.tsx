import {
  OrganizationPublicationHistoryScreen,
  organizationPublicationHistoryMetadata,
} from "../../../../../../../features/organizations/publication-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = organizationPublicationHistoryMetadata;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; contentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const scope = await params;
  return OrganizationPublicationHistoryScreen({ ...scope, searchParams });
}
