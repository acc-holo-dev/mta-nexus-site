import {
  CommercialPlansAdminScreen,
  commercialPlansAdminMetadata,
} from "../../../../features/commerce/commercial-plans-admin-server";

export const dynamic = "force-dynamic";

export const generateMetadata = commercialPlansAdminMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; page?: string | string[] }>;
}) {
  return CommercialPlansAdminScreen({ searchParams });
}
