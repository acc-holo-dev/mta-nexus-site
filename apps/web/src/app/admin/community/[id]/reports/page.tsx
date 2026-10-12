import {
  PublicationReportsPage,
  publicationReportsMetadata,
} from "../../../../../components/publication-reports-page";
export const dynamic = "force-dynamic";
export const generateMetadata = publicationReportsMetadata;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <PublicationReportsPage id={(await params).id} searchParams={searchParams} />;
}
